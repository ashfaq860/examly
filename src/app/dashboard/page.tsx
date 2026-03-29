//dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AcademyLayout from '@/components/AcademyLayout';
import { useUser } from '../context/userContext';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { FilePlus, BookOpen, Settings, Activity } from 'lucide-react';
import Loading from './generate-paper/loading';

const CACHE_KEY = 'dashboard-analytics';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface Analytics {
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

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics>({ recentActivity: [] });

  useEffect(() => {
    if (trialStatus?.message && !trialStatus.hasActiveSubscription) {
      router.push('/dashboard/settings');
    }
  }, [trialStatus, router]);

  useEffect(() => {
    const initDashboard = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          router.push('/auth/login');
          return;
        }

        const { data: role } = await supabase.rpc('get_user_role', { user_id: user.id });
        if (role !== 'teacher') {
          router.push('/');
          return;
        }

        setIsAuthorized(true);

        // Check cache for analytics
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setAnalytics(data);
            setIsLoading(false);
            return;
          }
        }

        const { data: papers } = await supabase
          .from('papers')
          .select('id, title, class_name, subject_name, created_at')
          .eq('created_by', user.id);

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

        setAnalytics({ recentActivity });

        // Cache the analytics
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: { recentActivity }, timestamp: Date.now() }));
      } catch (err) {
        console.error('Dashboard error:', err);
        router.push('/auth/login');
      } finally {
        setIsLoading(false);
      }
    };

    if (!trialLoading) initDashboard();
  }, [supabase, router, trialLoading]);

  if (isLoading || trialLoading) {
    return (
      <AcademyLayout>
        <div className="container-fluid text-center py-5">
         { <Loading />}
        </div>
      </AcademyLayout>
    );
  }

  if (!isAuthorized) return null;

  const subscriptionInfo = trialStatus
    ? {
        papersLeft: trialStatus.papersRemaining === 'unlimited' ? 'Unlimited' : trialStatus.papersRemaining,
        isTrial: trialStatus.isTrial,
        trialDaysLeft: trialStatus.daysRemaining,
        status: trialStatus.hasActiveSubscription ? 'Active' : 'Inactive',
        referralCode: trialStatus.referral_code || '',
      }
    : null;

  const hoverEffect = (e: React.MouseEvent<HTMLDivElement, MouseEvent>, enter: boolean) => {
    const el = e.currentTarget;
    el.style.transform = enter ? 'scale(1.05)' : 'scale(1)';
    el.style.boxShadow = enter
      ? '0 10px 20px rgba(0,0,0,0.15)'
      : '0 4px 6px rgba(0,0,0,0.1)';
  };

  return (
    <AcademyLayout>
      <div className="container-fluid">

        {trialStatus?.message && (
          <div className="alert alert-warning mb-4">
            {trialStatus.message}
          </div>
        )}



              {/* Full-width Papers Left & Plan Status */}
            <div className="alert alert-info ticker-wrapper mb-4">
        <div className="ticker">
          <span className="ticker-item">
            <strong>Papers Left:</strong> {subscriptionInfo?.papersLeft}
          </span>
          <span className="ticker-separator">•</span>
          <span className="ticker-item">
            <strong>Plan Status:</strong> {subscriptionInfo?.status}
          </span>
        </div>
      </div>

        {/* Dashboard Cards */}
        <div className="row g-4 mb-4">

          {/* Generate Paper */}
          <div className="col-12 col-md-6 col-lg-4">
            <div
              className="card h-100 text-center shadow"
              role="button"
              style={{ borderTop: '4px solid #3b82f6', transition: 'transform 0.3s, box-shadow 0.3s' }}
              onMouseEnter={(e) => hoverEffect(e, true)}
              onMouseLeave={(e) => hoverEffect(e, false)}
              onClick={() => router.push('/dashboard/generate-paper')}
            >
              <div className="card-body py-5 d-flex flex-column align-items-center">
                <FilePlus size={40} className="mb-3 text-primary" />
                <h5 className="fw-bold">Generate Paper</h5>
                <p className="mb-0 text-muted">Create question papers instantly</p>
              </div>
            </div>
          </div>

          {/* Generated Papers */}
          <div className="col-12 col-md-6 col-lg-4">
            <div
              className="card h-100 text-center shadow"
              role="button"
              style={{ borderTop: '4px solid #10b981', transition: 'transform 0.3s, box-shadow 0.3s' }}
              onMouseEnter={(e) => hoverEffect(e, true)}
              onMouseLeave={(e) => hoverEffect(e, false)}
              onClick={() => router.push('/dashboard/saved-papers')}
            >
              <div className="card-body py-5 d-flex flex-column align-items-center">
                <BookOpen size={40} className="mb-3 text-success" />
                <h5 className="fw-bold">Saved Papers</h5>
                <p className="mb-0 text-muted">View all your papers</p>
              </div>
            </div>
          </div>

          {/* Profile Settings */}
          <div className="col-12 col-md-6 col-lg-4">
            <div
              className="card h-100 text-center shadow"
              role="button"
              style={{ borderTop: '4px solid #f59e0b', transition: 'transform 0.3s, box-shadow 0.3s' }}
              onMouseEnter={(e) => hoverEffect(e, true)}
              onMouseLeave={(e) => hoverEffect(e, false)}
              onClick={() => router.push('/dashboard/settings')}
            >
              <div className="card-body py-5 d-flex flex-column align-items-center">
                <Settings size={40} className="mb-3 text-warning" />
                <h5 className="fw-bold">Profile Settings</h5>
                <p className="mb-0 text-muted">Manage your account preferences</p>
              </div>
            </div>
          </div>

        </div>

        {/* Recent Activity */}
        <div className="card shadow-sm mt-4">
          <div className="card-header bg-white d-flex align-items-center">
            <Activity size={20} className="me-2 text-primary" />
            <h5 className="mb-0 fw-semibold">Recent Activity</h5>
          </div>
          <div className="card-body p-0">
            {analytics.recentActivity.length === 0 ? (
              <div className="text-center text-muted py-5">
                <p className="fw-semibold mb-1">No papers generated yet</p>
                <small>Generate your first paper to see activity</small>
              </div>
            ) : (
              <ul className="list-group list-group-flush">
                {analytics.recentActivity.map((activity) => (
                  <li key={activity.id} className="list-group-item px-3 py-2">
                    <div className="row align-items-center g-3">
                      <div className="col-auto">
                        <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}>
                          <BookOpen size={18} />
                        </div>
                      </div>
                      <div className="col-12 col-lg-4">
                        <div className="fw-semibold">Paper Generated</div>
                        <small className="text-muted d-block text-truncate">{activity.title}</small>
                      </div>
                      <div className="col-12 col-lg-4">
                        <span className="badge bg-info-subtle text-info rounded-pill me-2">Class {activity.class}</span>
                        <span className="badge bg-success-subtle text-success rounded-pill">{activity.subject}</span>
                      </div>
                      <div className="col-12 col-lg-3 text-lg-end">
                        <small className="text-muted">{new Date(activity.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
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
