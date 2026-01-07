'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AcademyLayout from '@/components/AcademyLayout';
import StatCard from '@/components/academy/StatCard';
import ChartCard from '@/components/academy/ChartCard';
import ReferralSection from '@/components/ReferralSection';
import { useUser } from '../context/userContext';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Analytics {
  totalPapers: number;
  totalQuestions: number;
  papersByClass: { class: string; count: number }[];
  papersBySubject: { subject: string; count: number }[];
  recentActivity: {
    id: string;
    title: string;
    class: string;
    subject: string;
    date: string;
  }[];
}

export default function AcademyDashboard() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { trialStatus, isLoading: trialLoading } = useUser();

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics>({
    totalPapers: 0,
    totalQuestions: 0,
    papersByClass: [],
    papersBySubject: [],
    recentActivity: [],
  });

  // Redirect if trial message exists and no active subscription
  useEffect(() => {
    if (trialStatus?.message && !trialStatus.hasActiveSubscription) {
      router.push('/dashboard/settings');
    }
  }, [trialStatus, router]);

  // Fetch papers and questions for dashboard
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/login');
          return;
        }

        // Check user role
        const { data: roleData, error: roleError } = await supabase.rpc(
          'get_user_role',
          { user_id: user.id }
        );

        if (roleError || roleData !== 'teacher') {
          router.push('/');
          return;
        }

        // Fetch questions count and papers
        const [{ count: totalQuestions }, { data: papers }] = await Promise.all([
          supabase.from('questions').select('*', { count: 'exact', head: true }),
          supabase
            .from('papers')
            .select('id, title, class_name, subject_name, created_at')
            .eq('created_by', user.id),
        ]);

        // Process papers by class and subject
        const papersByClassMap: Record<string, number> = {};
        const papersBySubjectMap: Record<string, number> = {};

        papers?.forEach((p: any) => {
          const cls = p.class_name || 'N/A';
          const subj = p.subject_name || 'N/A';
          papersByClassMap[cls] = (papersByClassMap[cls] || 0) + 1;
          papersBySubjectMap[subj] = (papersBySubjectMap[subj] || 0) + 1;
        });

        const papersByClass = Object.keys(papersByClassMap).map((cls) => ({
          class: cls,
          count: papersByClassMap[cls],
        }));

        const papersBySubject = Object.keys(papersBySubjectMap).map((subj) => ({
          subject: subj,
          count: papersBySubjectMap[subj],
        }));

        const recentActivity = (papers || [])
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
          .map((paper: any) => ({
            id: paper.id,
            title: paper.title,
            class: paper.class_name || 'N/A',
            subject: paper.subject_name || 'N/A',
            date: paper.created_at,
          }));

        setAnalytics({
          totalPapers: trialStatus?.papersGenerated || papers?.length || 0,
          totalQuestions: totalQuestions || 0,
          papersByClass,
          papersBySubject,
          recentActivity,
        });
      } catch (error) {
        console.error('Error fetching dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!trialLoading) fetchData();
  }, [router, trialStatus, trialLoading, supabase]);

  if (loading || trialLoading) {
    return (
      <AcademyLayout>
        <div className="container-fluid text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      </AcademyLayout>
    );
  }

  // Subscription info for cards and referral section
  const subscriptionInfo = trialStatus
    ? {
        type: trialStatus.isTrial ? 'Trial' : trialStatus.subscriptionName || 'Premium',
        status: trialStatus.hasActiveSubscription ? 'active' : 'inactive',
        papersLeft:
          trialStatus.papersRemaining === 'unlimited'
            ? 'Unlimited'
            : trialStatus.papersRemaining,
        isTrial: trialStatus.isTrial,
        trialDaysLeft: trialStatus.daysRemaining,
        referralCode: trialStatus.referral_code || '',
      }
    : null;

  return (
    <AcademyLayout>
      <div className="container-fluid">

        {trialStatus?.message && (
          <div className="alert alert-warning mb-4">{trialStatus.message}</div>
        )}

        <ReferralSection referralCode={subscriptionInfo?.referralCode || ''} />

        {/* Stats Cards */}
        <div className="row g-4 mb-4">
          <div className="col-md-3">
            <StatCard
              title="Total Papers"
              value={analytics.totalPapers}
              icon="file-text"
              color="primary"
            />
          </div>
          <div className="col-md-3">
            <StatCard
              title={subscriptionInfo?.isTrial ? 'Trial Papers Left' : 'Papers Left'}
              value={subscriptionInfo?.papersLeft}
              icon="file-earmark-check"
              color={subscriptionInfo?.isTrial ? 'warning' : 'success'}
            />
          </div>
          <div className="col-md-3">
            <StatCard
              title="Questions"
              value={analytics.totalQuestions}
              icon="question-circle"
              color="info"
            />
          </div>
          <div className="col-md-3">
            <StatCard
              title={subscriptionInfo?.isTrial ? 'Trial Days Left' : 'Plan Status'}
              value={subscriptionInfo?.isTrial ? subscriptionInfo.trialDaysLeft : subscriptionInfo?.status}
              icon={subscriptionInfo?.isTrial ? 'clock' : 'shield-check'}
              color={subscriptionInfo?.isTrial ? 'warning' : 'success'}
            />
          </div>
        </div>

        {/* Charts */}
        <div className="row g-4 mb-4">
          {/* Papers by Class */}
          <div className="col-lg-6">
            <ChartCard title="Papers by Class">
              <div className="row g-3">
                {analytics.papersByClass.length === 0 ? (
                  <div className="col-12 text-center text-muted py-3">No data available</div>
                ) : (
                  analytics.papersByClass.map((item, idx) => {
                    const total = analytics.papersByClass.reduce((sum, i) => sum + i.count, 0);
                    const percentage = total ? ((item.count / total) * 100).toFixed(1) : 0;
                    const colors = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b'];
                    const color = colors[idx % colors.length];
                    return (
                      <div key={item.class} className="m-0">
                        <div className="d-flex justify-content-between fw-semibold mb-1">
                          <span>{item.class}</span>
                          <span>{item.count} ({percentage}%)</span>
                        </div>
                        <div className="progress rounded-pill" style={{ height: '10px', overflow: 'hidden' }}>
                          <div
                            className="progress-bar"
                            style={{ width: `${percentage}%`, backgroundColor: color, transition: 'width 0.6s ease' }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ChartCard>
          </div>

          {/* Papers by Subject */}
          <div className="col-lg-6">
            <ChartCard title="Papers by Subject">
              {analytics.papersBySubject.length === 0 ? (
                <div className="text-center text-muted py-4">No data available</div>
              ) : (
                <div className="row g-3">
                  {analytics.papersBySubject.map((item, idx) => {
                    const total = analytics.papersBySubject.reduce((sum, i) => sum + i.count, 0);
                    const percentage = total ? ((item.count / total) * 100).toFixed(1) : 0;
                    const colors = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b'];
                    const color = colors[idx % colors.length];
                    return (
                      <div key={item.subject} className="m-0">
                        <div className="d-flex justify-content-between fw-semibold mb-1">
                          <span>{item.subject}</span>
                          <span>{item.count} ({percentage}%)</span>
                        </div>
                        <div className="progress rounded-pill" style={{ height: '12px', overflow: 'hidden' }}>
                          <div
                            className="progress-bar"
                            style={{ width: `${percentage}%`, backgroundColor: color, transition: 'width 0.6s ease' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ChartCard>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card shadow-sm mt-4">
          <div className="card-header bg-white d-flex align-items-center">
            <i className="bi bi-activity me-2 text-primary fs-5"></i>
            <h5 className="mb-0 fw-semibold">Recent Activity</h5>
          </div>
          <div className="card-body p-0">
            {analytics.recentActivity.length === 0 ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-file-earmark-x fs-1 mb-3 d-block"></i>
                <p className="fw-semibold mb-1">No papers generated yet</p>
                <small>Generate your first paper to see activity</small>
              </div>
            ) : (
              <ul className="list-group list-group-flush">
                {analytics.recentActivity.map((activity) => (
                  <li key={activity.id} className="list-group-item px-3 py-1 activity-item">
                    <div className="row align-items-center g-3">
                      <div className="col-auto">
                        <div className="activity-icon bg-primary text-white rounded-circle d-flex align-items-center justify-content-center">
                          <i className="bi bi-file-earmark-text"></i>
                        </div>
                      </div>
                      <div className="col-12 col-lg-4">
                        <div className="fw-semibold">Paper Generated</div>
                        <small className="text-muted d-block text-truncate">
                          Institute: {activity.title}
                        </small>
                      </div>
                      <div className="col-12 col-lg-4">
                        <div className="d-flex gap-2 flex-wrap">
                          <span className="badge bg-info-subtle text-info rounded-pill">
                            <i className="bi bi-mortarboard me-1"></i>
                            Class {activity.class}
                          </span>
                          <span className="badge bg-success-subtle text-success rounded-pill">
                            <i className="bi bi-book me-1"></i>
                            {activity.subject}
                          </span>
                        </div>
                      </div>
                      <div className="col-12 col-lg-3 text-lg-end">
                        <small className="text-muted">
                          <i className="bi bi-calendar-event me-1"></i>
                          {new Date(activity.date).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </small>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </AcademyLayout>
  );
}
