'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AcademyLayout from '@/components/AcademyLayout';
import SubscriptionStatus from '@/components/academy/SubscriptionStatus';
import StatCard from '@/components/academy/StatCard';
import ChartCard from '@/components/academy/ChartCard';
import DoughnutChart from '@/components/academy/DoughnutChart';
import { useUser } from '../context/userContext';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function AcademyDashboard() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { trialStatus, isLoading: trialLoading } = useUser();

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalPapers: 0,
    totalQuestions: 0,
    papersByClass: [] as any[],
    papersBySubject: [] as any[],
    recentActivity: [] as any[],
    subscription: {
      type: 'Trial',
      status: 'inactive',
      endDate: '',
      papersLeft: 0,
      isTrial: true,
      trialDaysLeft: 0,
      totalPapersInPlan: 0
    }
  });

  /* 🚨 Redirect if missing required profile info */
  useEffect(() => {
    if (trialStatus?.message && !trialStatus.hasActiveSubscription) {
      router.push('/dashboard/settings');
    }
  }, [trialStatus, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/login');
          return;
        }

        /* 🔐 Role Check */
        const { data: roleData, error: roleError } = await supabase
          .rpc('get_user_role', { user_id: user.id });

        if (roleError || roleData !== 'teacher') {
          router.push('/');
          return;
        }

        const [
          { count: totalPapers },
          { count: totalQuestions },
          { data: papersByClass },
          { data: papersBySubject },
          { data: recentActivity },
          { data: subscriptionData }
        ] = await Promise.all([

          supabase
            .from('papers')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', user.id),

          supabase
            .from('questions')
            .select('*', { count: 'exact', head: true }),

          supabase.rpc('get_user_papers_by_class', { user_id: user.id }),

          supabase.rpc('get_user_papers_by_subject', { user_id: user.id }),

          /* ✅ FIXED QUERY (joins class + subject names) */
          supabase
            .from('papers')
            .select(`
              id,
              title,
              created_at,
              classes ( name ),
              subjects ( name )
            `)
            .eq('created_by', user.id)
            .order('created_at', { ascending: false })
            .limit(5),

          supabase
            .from('user_packages')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()
        ]);

        const isTrial = trialStatus?.isTrial || false;
        const papersLeft = trialStatus?.papersRemaining || 0;
        const trialDaysLeft = trialStatus?.daysRemaining || 0;

        let subscriptionType = 'Trial';
        let subscriptionStatus = 'inactive';
        let totalPapersInPlan = 5;

        if (subscriptionData) {
          subscriptionType = subscriptionData.is_trial ? 'Trial' : 'Premium';
          subscriptionStatus = 'active';
          totalPapersInPlan = subscriptionData.papers_remaining !== null
            ? subscriptionData.papers_remaining + (totalPapers || 0)
            : (subscriptionData.is_trial ? 5 : 100);
        } else if (isTrial) {
          subscriptionStatus = 'active';
        }

        setAnalytics({
          totalPapers: totalPapers || 0,
          totalQuestions: totalQuestions || 0,
          papersByClass: papersByClass || [],
          papersBySubject: papersBySubject || [],

          /* ✅ FIXED MAPPING */
          recentActivity: (recentActivity || []).map((paper: any) => ({
            id: paper.id,
            title: paper.title,
            class: paper.classes?.name ?? 'N/A',
            subject: paper.subjects?.name ?? 'N/A',
            date: new Date(paper.created_at).toLocaleDateString()
          })),

          subscription: {
            type: subscriptionType,
            status: subscriptionStatus,
            endDate: subscriptionData?.expires_at
              ? new Date(subscriptionData.expires_at).toLocaleDateString()
              : trialStatus?.trialEndsAt
                ? new Date(trialStatus.trialEndsAt).toLocaleDateString()
                : '',
            papersLeft,
            isTrial,
            trialDaysLeft,
            totalPapersInPlan
          }
        });

      } catch (error) {
        console.error('Error fetching academy dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!trialLoading) {
      fetchData();
    }
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

  return (
    <AcademyLayout>
      <div className="container-fluid">

        {trialStatus?.message && (
          <div className="alert alert-warning mb-4">
            {trialStatus.message}
          </div>
        )}

        <SubscriptionStatus subscription={analytics.subscription} />

        {/* Stats */}
        <div className="row g-4 mb-4">
          <div className="col-md-3">
            <StatCard title="Total Papers" value={analytics.totalPapers} icon="file-text" color="primary" />
          </div>
          <div className="col-md-3">
            <StatCard
              title={analytics.subscription.isTrial ? "Trial Papers Left" : "Papers Left"}
              value={analytics.subscription.papersLeft}
              icon="file-earmark-check"
              color={analytics.subscription.isTrial ? "warning" : "success"}
              subtitle={!analytics.subscription.isTrial ? `of ${analytics.subscription.totalPapersInPlan}` : ''}
            />
          </div>
          <div className="col-md-3">
            <StatCard title="Questions" value={analytics.totalQuestions} icon="question-circle" color="info" />
          </div>
          <div className="col-md-3">
            <StatCard
              title={analytics.subscription.isTrial ? "Trial Days Left" : "Plan Status"}
              value={analytics.subscription.isTrial ? analytics.subscription.trialDaysLeft : analytics.subscription.status}
              icon={analytics.subscription.isTrial ? "clock" : "shield-check"}
              color={analytics.subscription.isTrial ? "warning" : "success"}
            />
          </div>
        </div>

        {/* Charts */}
        <div className="row g-4 mb-4">
          <div className="col-lg-6">
            <ChartCard title="Papers by Class">
              {analytics.papersByClass.map((item: any) => (
                <div key={item.class} className="mb-3">
                  <div className="d-flex justify-content-between">
                    <span>{item.class}</span>
                    <span>{item.count}</span>
                  </div>
                  <div className="progress" style={{ height: 20 }}>
                    <div
                      className="progress-bar bg-primary"
                      style={{
                        width: `${(item.count / Math.max(...analytics.papersByClass.map((i: any) => i.count))) * 100}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </ChartCard>
          </div>

          <div className="col-lg-6">
            <ChartCard title="Papers by Subject">
              <div className="d-flex align-items-center" style={{ height: 300 }}>
                <div className="w-50">
                  <DoughnutChart data={analytics.papersBySubject} />
                </div>
                <div className="w-50 ps-4">
                  {analytics.papersBySubject.map((item: any) => (
                    <div key={item.subject} className="mb-2">
                      {item.subject} ({item.count})
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h5 className="mb-0">Recent Activity</h5>
          </div>
          <div className="card-body">
            {analytics.recentActivity.map((activity: any) => (
              <div key={activity.id} className="d-flex justify-content-between mb-3">
                <div>
                  <h6 className="mb-1">{activity.title}</h6>
                  <small className="text-muted">
                    Paper Generated for Class {activity.class} • {activity.subject} subject • {activity.date}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </AcademyLayout>
  );
}
