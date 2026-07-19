// src/app/dashboard/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Phone,
  University,
  FileText,
  Calendar,
  Package as PackageIcon,
  Clock,
  Mail,
  Copy,
  Gift,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import toast from "react-hot-toast";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  institution: string | null;
  created_at: string;
  trial_ends_at: string | null;
  subscription_status: string | null;
  updated_at: string;
  papers_generated: number | null;
  cellno: string | null;
  logo: string | null;
  referral_code?: string | null;
};

type Package = {
  id: string;
  name: string;
  type: string;
  paper_quantity: number | null;
  duration_days: number | null;
  price: number;
  description: string | null;
};

type UserPackage = {
  id: string;
  package_id: string;
  papers_remaining: number | null;
  expires_at: string | null;
  is_trial: boolean;
  stripe_subscription_id: string | null;
  created_at: string;
  is_active: boolean;
  packages: Package;
};

export default function ProfilePage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userPackages, setUserPackages] = useState<UserPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Check authentication and redirect if not logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();

        if (authError || !session) {
          window.location.href = '/auth/login';
          return;
        }

        const { data: roleData, error: roleError } = await supabase.rpc(
          'get_user_role',
          { user_id: session.user.id }
        );

        if (roleError || (roleData !== 'teacher' && roleData !== 'academy')) {
          router.push('/');
          return;
        }

        setSession(session);
        setIsAuthorized(true);
      } catch (error) {
        console.error('Error checking auth:', error);
        window.location.href = '/auth/login';
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.href = '/auth/login';
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  // Fetch profile & packages only if authorized
  useEffect(() => {
    const fetchProfileAndPackages = async () => {
      if (!isAuthorized) return;

      setLoading(true);
      setError(null);
      try {
        if (!session) throw new Error("Please log in to view your profile");

        const response = await fetch('/api/profile');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch profile: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        setProfile(data.profile);
        setUserPackages(data.userPackages || []);
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.message || "An error occurred while fetching data");
      } finally {
        setLoading(false);
      }
    };

    if (isAuthorized && session) fetchProfileAndPackages();
  }, [session, isAuthorized]);

  if (!authChecked || (loading && isAuthorized)) {
    return (
      <div className="container-fluid text-center py-5">
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  if (!isAuthorized) return null;

  const getPackageStatus = (userPackage: UserPackage) => {
    const now = new Date();
    const expiresAt = userPackage.expires_at ? new Date(userPackage.expires_at) : null;

    if (!userPackage.is_active) return { status: 'pending', label: 'Pending', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };

    const isExpiredByDate = expiresAt && expiresAt < now;
    const isPaperPackEmpty =
      userPackage.packages.type === 'paper_pack' &&
      userPackage.papers_remaining !== null &&
      userPackage.papers_remaining <= 0;

    if (isExpiredByDate || isPaperPackEmpty) return { status: 'expired', label: 'Expired', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };

    return { status: 'active', label: 'Active', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' };
  };

  const calculateDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const expireDate = new Date(expiresAt);
    const today = new Date();
    const diffTime = expireDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getReferralLink = () => {
    if (!profile?.referral_code) return "";
    return `${window.location.origin}/auth/signup?ref=${profile.referral_code}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied!");
  };

  if (error) {
    return (
      <div style={{ maxWidth: 480, margin: '3rem auto', textAlign: 'center' }}>
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
          borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
        }}>
          <strong>Error: </strong>{error}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(7,62,140,0.25)',
        }}>
          <User size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>My Profile</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Your academy account, plan and referral overview
          </p>
        </div>
      </div>

      {profile && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)',
            padding: '1.5rem', marginBottom: '1.5rem', boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Profile header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {profile.logo ? (
              <img
                src={profile.logo}
                alt="Profile"
                style={{
                  width: 88, height: 88, borderRadius: '50%', objectFit: 'cover',
                  border: '3px solid #fff', boxShadow: 'var(--shadow-md)',
                }}
              />
            ) : (
              <div style={{
                width: 88, height: 88, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700,
                fontSize: '2.2rem', background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
                boxShadow: 'var(--shadow-md)',
              }}>
                {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}

            <div style={{ flex: 1, minWidth: 200 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {profile.full_name || "No Name Provided"}
              </h2>
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0 10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Mail size={14} /> {profile.email}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge label={profile.role} color="#fff" bg="var(--brand-primary)" />
                <Badge
                  label={profile.subscription_status === 'active' ? 'Active' : 'Inactive'}
                  color="#fff"
                  bg={profile.subscription_status === 'active' ? '#16a34a' : '#94a3b8'}
                />
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            <InfoCard icon={University} label="Institution" value={profile.institution || "Not specified"} color="var(--brand-primary)" />
            <InfoCard icon={FileText} label="Papers Generated" value={String(profile.papers_generated || 0)} color="var(--brand-accent)" />
            <InfoCard icon={Calendar} label="Member Since" value={new Date(profile.created_at).toLocaleDateString()} color="#16a34a" />
            <InfoCard icon={Phone} label="Phone Number" value={profile.cellno || "Not provided"} color="#f59e0b" />
          </div>

          {/* Trial info */}
          {profile.trial_ends_at && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginTop: '1rem',
              background: 'rgba(245,158,11,0.1)', borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Clock size={17} style={{ color: '#b45309' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trial Period</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400e' }}>
                  Your trial ends on {new Date(profile.trial_ends_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}

          {/* Referral */}
          {profile.referral_code && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginTop: '1rem', flexWrap: 'wrap',
              background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: 'var(--brand-primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Gift size={17} style={{ color: 'var(--brand-primary)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Referral Link</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getReferralLink()}
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(getReferralLink())}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 0.9rem',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-soft)', color: 'var(--brand-primary)', fontWeight: 600,
                  fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <Copy size={13} /> Copy
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Subscriptions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
        <PackageIcon size={18} style={{ color: 'var(--brand-primary)' }} />
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>My Subscriptions</h2>
      </div>

      {userPackages.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)',
          padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)',
        }}>
          <ShieldCheck size={28} style={{ opacity: 0.35, marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>No subscription packages found.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {userPackages.map((userPackage) => {
            const packageStatus = getPackageStatus(userPackage);
            const daysRemaining = calculateDaysRemaining(userPackage.expires_at);

            return (
              <motion.div
                key={userPackage.id}
                whileHover={{ y: -3 }}
                style={{
                  background: '#fff', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
                }}
              >
                <div style={{ padding: '1rem 1.1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>{userPackage.packages.name}</h3>
                    <Badge label={packageStatus.label} color={packageStatus.color} bg={packageStatus.bg} />
                  </div>
                  {userPackage.packages.description && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{userPackage.packages.description}</p>
                  )}
                </div>
                <div style={{ padding: '0.9rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Row label="Type" value={userPackage.packages.type} />
                  <Row label="Price" value={`Rs. ${userPackage.packages.price}`} />
                  <Row
                    label="Papers Remaining"
                    value={userPackage.packages.type === 'paper_pack' ? String(userPackage.papers_remaining ?? 0) : 'Unlimited'}
                  />
                  {userPackage.expires_at && (
                    <Row label="Expires" value={new Date(userPackage.expires_at).toLocaleDateString()} />
                  )}
                  {daysRemaining !== null && packageStatus.status === 'active' && (
                    <Row
                      label="Days Remaining"
                      value={String(daysRemaining)}
                      valueColor={daysRemaining <= 7 ? '#ef4444' : '#16a34a'}
                    />
                  )}
                  {userPackage.is_trial && (
                    <div style={{
                      marginTop: 4, padding: '0.4rem 0.65rem', borderRadius: 'var(--radius-md)',
                      background: 'rgba(245,158,11,0.1)', color: '#92400e', fontSize: '0.76rem', fontWeight: 600,
                    }}>
                      Trial Package
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 99,
      fontSize: '0.72rem', fontWeight: 700, color, background: bg, textTransform: 'capitalize',
    }}>
      {label}
    </span>
  );
}

function InfoCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, background: '#fff',
      borderRadius: 'var(--radius-lg)', padding: '0.75rem 0.9rem', boxShadow: 'var(--shadow-xs)',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor || 'var(--text-main)', textTransform: 'capitalize' }}>{value}</span>
    </div>
  );
}
