//dashboard/page.tsx
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AcademyLayout from '@/components/AcademyLayout';
import { useUser } from '../context/userContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { FilePlus, BookOpen, Settings, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import Loading from './generate-paper/loading';
import toast from 'react-hot-toast';

const REWARD_TOAST_KEY = 'profile-reward-toast-shown';

const CACHE_KEY = 'dashboard-analytics';
const CACHE_DURATION = 5 * 60 * 1000;

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
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const { trialStatus, isLoading: trialLoading } = useUser();

  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) return false;
      }
    } catch {}
    return true;
  });

  const [isAuthorized, setIsAuthorized] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) return true;
      }
    } catch {}
    return false;
  });

  const [analytics, setAnalytics] = useState<Analytics>(() => {
    if (typeof window === 'undefined') return { recentActivity: [] };
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) return data;
      }
    } catch {}
    return { recentActivity: [] };
  });

  const hasFetched = useRef(false);

  useEffect(() => {
    if (trialStatus?.message && !trialStatus.hasActiveSubscription) {
      if (typeof window !== 'undefined' && !sessionStorage.getItem(REWARD_TOAST_KEY)) {
        sessionStorage.setItem(REWARD_TOAST_KEY, '1');
        toast.success(
          'Complete your profile with a working mobile number to unlock a 3-month free reward for unlimited papers!',
          { duration: 6000, icon: '🎁' }
        );
      }
      router.push('/dashboard/settings');
    }
  }, [trialStatus, router]);

  useEffect(() => {
    if (trialLoading) return;
    if (hasFetched.current) return;

    const initDashboard = async () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setAnalytics(data);
            setIsAuthorized(true);
            setIsLoading(false);
            supabase.auth.getUser().then(({ data: { user } }) => {
              if (!user) window.location.href = '/auth/login';
            });
            return;
          }
        }

        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) { window.location.href = '/auth/login'; return; }

        const { data: role } = await supabase.rpc('get_user_role', { user_id: user.id });
        if (role !== 'teacher') { router.push('/'); return; }

        setIsAuthorized(true);

        const { data: papers } = await supabase
          .from('papers')
          .select('id, title, class_name, subject_name, created_at')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        const recentActivity = (papers || []).map((paper: any) => ({
          id: paper.id,
          title: paper.title,
          class: paper.class_name || 'N/A',
          subject: paper.subject_name || 'N/A',
          date: paper.created_at,
        }));

        const freshData = { recentActivity };
        setAnalytics(freshData);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: freshData, timestamp: Date.now() }));
      } catch (err) {
        console.error('Dashboard error:', err);
        window.location.href = '/auth/login';
      } finally {
        setIsLoading(false);
        hasFetched.current = true;
      }
    };

    initDashboard();
  }, [supabase, router, trialLoading]);

  if ((isLoading && analytics.recentActivity.length === 0) || trialLoading) {
    return (
      <div className="container-fluid text-center py-5">
        <Loading />
      </div>
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

  const quickActions = [
    {
      icon: FilePlus,
      label: "Generate Paper",
      description: "Create a new question paper",
      href: "/dashboard/generate-paper",
      gradient: "linear-gradient(135deg, #073e8c 0%, #0b63d4 100%)",
      iconBg: "rgba(255,255,255,0.15)",
    },
    {
      icon: BookOpen,
      label: "Saved Papers",
      description: "Browse your paper library",
      href: "/dashboard/saved-papers",
      gradient: "linear-gradient(135deg, #1ba699 0%, #0e7a71 100%)",
      iconBg: "rgba(255,255,255,0.15)",
    },
    {
      icon: Settings,
      label: "Settings",
      description: "Manage your account",
      href: "/dashboard/settings",
      gradient: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
      iconBg: "rgba(255,255,255,0.15)",
    },
  ];

  return (
    <div>
      {/* Trial warning */}
      {trialStatus?.message && (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            border: '1px solid #fde68a', borderRadius: 'var(--radius-lg)',
            padding: '0.85rem 1rem', marginBottom: '1.5rem',
            fontSize: '0.875rem', color: '#92400e',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1, color: '#f59e0b' }} />
          <span>{trialStatus.message}</span>
        </div>
      )}

      {/* Status bar */}
      {subscriptionInfo && (
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.75rem',
            background: '#fff', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)', padding: '0.85rem 1.1rem',
            marginBottom: '1.5rem', boxShadow: 'var(--shadow-sm)',
          }}
        >
          <StatusPill label="Papers Left" value={String(subscriptionInfo.papersLeft)} color="#073e8c" />
          <div style={{ width: 1, background: 'var(--border-subtle)', alignSelf: 'stretch', flexShrink: 0 }} />
          <StatusPill
            label="Plan Status"
            value={subscriptionInfo.status}
            color={subscriptionInfo.status === 'Active' ? '#1ba699' : '#f59e0b'}
          />
          {subscriptionInfo.isTrial && subscriptionInfo.trialDaysLeft !== null && (
            <>
              <div style={{ width: 1, background: 'var(--border-subtle)', alignSelf: 'stretch', flexShrink: 0 }} />
              <StatusPill label="Trial Days Left" value={String(subscriptionInfo.trialDaysLeft)} color="#7c3aed" />
            </>
          )}
        </div>
      )}

      {/* Quick action cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {quickActions.map(({ icon: Icon, label, description, href, gradient, iconBg }) => (
          <button
            key={href}
            onClick={() => router.push(href)}
            style={{
              all: 'unset', cursor: 'pointer', display: 'block',
              background: gradient, borderRadius: 'var(--radius-xl)',
              padding: '1.4rem 1.25rem', color: '#fff', textAlign: 'left',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.22)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
            }}
          >
            {/* Background decoration */}
            <div style={{
              position: 'absolute', top: -20, right: -20, width: 100, height: 100,
              borderRadius: '50%', background: 'rgba(255,255,255,0.07)',
            }} />
            <div style={{
              position: 'absolute', bottom: -30, right: 20, width: 80, height: 80,
              borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
            }} />

            <div style={{
              width: 40, height: 40, borderRadius: 10, background: iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '0.9rem', position: 'relative',
            }}>
              <Icon size={20} color="#fff" />
            </div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', lineHeight: 1.2, marginBottom: 4, position: 'relative' }}>
              {label}
            </p>
            <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.75, position: 'relative' }}>
              {description}
            </p>
            <div style={{
              position: 'absolute', bottom: '1rem', right: '1rem',
              opacity: 0.4,
            }}>
              <ChevronRight size={16} />
            </div>
          </button>
        ))}
      </div>

      {/* Recent Activity */}
      <div
        style={{
          background: '#fff', borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--brand-primary-50)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Clock size={16} style={{ color: 'var(--brand-primary)' }} />
            </div>
            <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Recent Activity
            </h2>
          </div>
          {isLoading && (
            <div className="spinner-border spinner-border-sm text-secondary opacity-50" style={{ width: 16, height: 16 }} />
          )}
        </div>

        {analytics.recentActivity.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--surface-soft)', margin: '0 auto 1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={24} style={{ opacity: 0.4 }} />
            </div>
            <p style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.9rem' }}>No papers generated yet</p>
            <p style={{ fontSize: '0.8rem', margin: 0 }}>Generate your first paper to see activity here</p>
            <button
              onClick={() => router.push('/dashboard/generate-paper')}
              style={{
                marginTop: '1.25rem', padding: '0.5rem 1.25rem',
                background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
                color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Generate First Paper
            </button>
          </div>
        ) : (
          <div>
            {analytics.recentActivity.map((activity, idx) => (
              <div
                key={activity.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '0.85rem 1.25rem',
                  borderBottom: idx < analytics.recentActivity.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  transition: 'background 0.15s ease',
                  cursor: 'default',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--brand-primary-50) 0%, rgba(27,166,153,0.08) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <BookOpen size={16} style={{ color: 'var(--brand-primary)' }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                    {activity.title || 'Paper Generated'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-block', padding: '1px 8px',
                      background: 'rgba(7,62,140,0.07)', color: 'var(--brand-primary)',
                      borderRadius: 99, fontSize: '0.72rem', fontWeight: 600,
                    }}>
                      Class {activity.class}
                    </span>
                    <span style={{
                      display: 'inline-block', padding: '1px 8px',
                      background: 'rgba(27,166,153,0.08)', color: 'var(--brand-accent)',
                      borderRadius: 99, fontSize: '0.72rem', fontWeight: 600,
                    }}>
                      {activity.subject}
                    </span>
                  </div>
                </div>

                <time style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {new Date(activity.date).toLocaleDateString('en-US', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </time>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}:</span>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
