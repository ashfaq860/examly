// examly/src/app/dashboard/settings/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin, User, Phone, University, Mail, Save, Upload, X, Calendar,
  CheckCircle, AlertCircle, Package, FileText, Clock, Crown, Gift, ShieldCheck, FilePlus,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useUser } from "@/app/context/userContext";
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  institution: string | null;
  address: string | null;
  created_at: string;
  trial_ends_at: string | null;
  subscription_status: string | null;
  updated_at: string;
  papers_generated: number | null;
  cellno: string | null;
  logo: string | null;
  trial_given: boolean;
};

export default function ProfileSettingsPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cellnoStatus, setCellnoStatus] = useState<'valid' | 'invalid' | 'checking' | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const { trialStatus, isLoading: trialLoading, refreshTrialStatus } = useUser();

  const [formData, setFormData] = useState({
    full_name: '',
    institution: '',
    cellno: '',
    email: '',
    address: ''
  });

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

        if (roleError || roleData !== 'teacher') {
          router.push('/');
          return;
        }

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

  // Fetch profile only if authorized
  useEffect(() => {
    const fetchProfile = async () => {
      if (!isAuthorized) return;

      setLoading(true);
      try {
        const res = await fetch("/api/profile/update", { method: "GET", credentials: "include" });
        if (!res.ok) throw new Error(await res.text() || "Failed to fetch profile");
        const data = await res.json();
        setProfile(data);
      } catch (err: any) {
        console.error("Error fetching profile:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthorized) fetchProfile();
  }, [isAuthorized]);

  // Populate form when profile is loaded
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        institution: profile.institution || '',
        cellno: profile.cellno || '',
        email: profile.email || '',
        address: profile.address || ''
      });
    }
  }, [profile]);

  // Validate phone number
  const validatePhoneNumber = (phone: string) => /^03\d{9}$/.test(phone.replace(/\D/g, ''));

  // Check cellno availability
  useEffect(() => {
    const checkCellnoAvailability = async () => {
      if (!formData.cellno || formData.cellno === profile?.cellno) return setCellnoStatus(null);
      if (!validatePhoneNumber(formData.cellno)) return setCellnoStatus('invalid');

      setCellnoStatus('checking');
      try {
        const res = await fetch('/api/profile/check-cellno', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cellno: formData.cellno }),
        });
        setCellnoStatus(res.ok ? 'valid' : 'invalid');
      } catch {
        setCellnoStatus('invalid');
      }
    };

    const timeoutId = setTimeout(checkCellnoAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.cellno, profile?.cellno]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'cellno') {
      let formattedValue = value.replace(/\D/g, '').slice(0, 11);
      if (formattedValue.length > 4) formattedValue = `${formattedValue.slice(0, 4)}-${formattedValue.slice(4)}`;
      setFormData(prev => ({ ...prev, [name]: formattedValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Ask the user if they'd like to jump straight into generating a paper
  const promptGeneratePaper = () => {
    toast.custom(
      (t) => (
        <div
          style={{
            background: '#fff',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-subtle)',
            padding: '1rem 1.1rem',
            maxWidth: 360,
            opacity: t.visible ? 1 : 0,
            transform: t.visible ? 'translateY(0)' : 'translateY(-8px)',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FilePlus size={16} color="#fff" />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                Profile updated!
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Would you like to generate a question paper now?
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => { toast.dismiss(t.id); router.push('/dashboard/generate-paper'); }}
              style={{
                flex: 1, padding: '0.5rem 0.75rem', border: 'none', cursor: 'pointer',
                borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.82rem',
                color: '#fff', fontFamily: 'inherit',
                background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
              }}
            >
              Yes, generate paper
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{
                padding: '0.5rem 0.75rem', cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.82rem',
                color: 'var(--text-muted)', background: 'var(--surface-soft)', border: '1px solid var(--border-subtle)',
              }}
            >
              Not now
            </button>
          </div>
        </div>
      ),
      { duration: 9000 }
    );
  };

  // Submit profile changes
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (formData.cellno && !validatePhoneNumber(formData.cellno)) {
      setError("Please enter a valid 11-digit phone number starting with 03");
      setSaving(false);
      return;
    }

    if (formData.cellno && formData.cellno !== profile?.cellno && cellnoStatus !== 'valid') {
      setError("Please wait while we check phone number availability");
      setSaving(false);
      return;
    }

    const justAddedCellno = !!formData.cellno && formData.cellno !== profile?.cellno;

    try {
      const res = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error(await res.text() || "Failed to update profile");
      const updatedData = await res.json();

      setProfile(prev => prev ? { ...prev, ...updatedData } : null);

      toast.success(
        justAddedCellno
          ? "Profile updated! Your 3-month free reward is now active."
          : "Profile updated successfully!"
      );

      await refreshTrialStatus();
      promptGeneratePaper();

    } catch (err: any) {
      setError(err.message || "An error occurred while updating profile");
      toast.error(err.message || "An error occurred while updating profile");
    } finally {
      setSaving(false);
    }
  };

  // Logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) throw new Error('Select an image to upload.');
      const file = e.target.files[0];
      if (file.size / 1024 > 500) throw new Error('Image must be <500KB');
      if (!['image/jpeg','image/png','image/gif'].includes(file.type)) throw new Error('Only JPG, PNG, GIF allowed');

      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/profile/logo', { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) throw new Error(await res.text() || "Failed to upload logo");
      const data = await res.json();
      setProfile(prev => prev ? { ...prev, logo: data.logo } : null);
      toast.success("Profile picture updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Error uploading image");
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    try {
      const res = await fetch('/api/profile/logo', { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(await res.text() || "Failed to remove logo");
      setProfile(prev => prev ? { ...prev, logo: null } : null);
      toast.success("Profile picture removed successfully!");
    } catch (err: any) {
      toast.error(err.message || "Error removing profile picture");
    }
  };

  // Package/trial status pill data
  const getStatusInfo = () => {
    if (trialLoading || !trialStatus) return null;
    const { isTrial, trialEndsAt, hasActiveSubscription, papersRemaining, subscriptionName, subscriptionType, subscriptionEndDate, message } = trialStatus;

    if (message) {
      return { tone: 'warning', icon: Gift, title: 'Reward Available', lines: [message] };
    }
    if (isTrial && trialEndsAt) {
      return {
        tone: 'success', icon: Crown, title: 'Free Trial Active',
        lines: [`Ends on ${new Date(trialEndsAt).toLocaleDateString()}`, 'Unlimited paper generation during your trial'],
      };
    }
    if (hasActiveSubscription) {
      return {
        tone: 'primary', icon: Crown, title: subscriptionName || 'Active Subscription',
        lines: [
          subscriptionType === 'paper_pack'
            ? `${papersRemaining === 'unlimited' ? 'Unlimited' : papersRemaining} papers remaining`
            : `Renews on ${subscriptionEndDate ? new Date(subscriptionEndDate).toLocaleDateString() : 'N/A'}`,
        ],
      };
    }
    return {
      tone: 'muted', icon: FileText, title: 'Free Plan',
      lines: [papersRemaining === 0 ? 'No papers remaining — upgrade to generate more.' : `${papersRemaining} papers remaining`],
    };
  };

  const statusInfo = getStatusInfo();
  const toneColors: Record<string, { bg: string; border: string; fg: string }> = {
    warning: { bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '#fde68a', fg: '#92400e' },
    success: { bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', border: '#a7f3d0', fg: '#065f46' },
    primary: { bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '#bfdbfe', fg: 'var(--brand-primary)' },
    muted:   { bg: 'var(--surface-soft)', border: 'var(--border-subtle)', fg: 'var(--text-muted)' },
  };

  const showRewardBanner = !loading && profile && !profile.cellno;

  // Loading state
  if (!authChecked || (loading && isAuthorized)) {
    return (
      <div className="container-fluid text-center py-5">
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  if (!isAuthorized) return null;

  if (error && !profile) return (
    <div style={{ maxWidth: 480, margin: '3rem auto', textAlign: 'center' }}>
      <div style={{
        background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
        borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1rem',
      }}>
        <strong>Error: </strong>{error}
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '0.6rem 1.5rem', border: 'none', borderRadius: 'var(--radius-md)',
          background: 'var(--brand-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  );

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
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Profile Settings
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Manage your academy profile and account details
          </p>
        </div>
      </div>

      {/* Reward banner */}
      {showRewardBanner && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            border: '1px solid #fde68a', borderRadius: 'var(--radius-xl)',
            padding: '1rem 1.25rem', marginBottom: '1.5rem',
          }}
        >
          <div style={{
            width: 42, height: 42, borderRadius: 11, flexShrink: 0,
            background: 'rgba(245,158,11,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Gift size={20} style={{ color: '#b45309' }} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#92400e' }}>
              Get 3 months free — unlimited papers!
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#92400e', opacity: 0.85 }}>
              Add a working mobile number below to activate your free reward instantly.
            </p>
          </div>
        </motion.div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '1.5rem', alignItems: 'start' }} className="settings-grid">
        {/* Main form card */}
        <div style={{
          background: '#fff', borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <ShieldCheck size={16} style={{ color: 'var(--brand-primary)' }} />
            <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Edit Your Profile
            </h2>
          </div>

          <div style={{ padding: '1.25rem' }}>
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                borderRadius: 'var(--radius-md)', padding: '0.65rem 0.9rem', marginBottom: '1rem', fontSize: '0.85rem',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  style={{ border: 'none', background: 'transparent', color: '#991b1b', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Logo upload */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={fieldLabelStyle}>
                  Academy Logo <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(for question papers)</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    {profile?.logo ? (
                      <img
                        src={profile.logo}
                        alt="Profile"
                        style={{
                          width: 88, height: 88, borderRadius: '50%', objectFit: 'cover',
                          border: '3px solid var(--brand-primary-50)',
                        }}
                      />
                    ) : (
                      <div style={{
                        width: 88, height: 88, borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700,
                        fontSize: '2rem', background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
                      }}>
                        {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    {profile?.logo && (
                      <button
                        type="button"
                        onClick={removeLogo}
                        style={{
                          position: 'absolute', top: -2, right: -2, width: 24, height: 24, borderRadius: '50%',
                          border: '2px solid #fff', background: '#ef4444', color: '#fff', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="logo-upload" style={{ ...secondaryBtnStyle, display: 'inline-flex', marginBottom: 6 }}>
                      {uploading ? (
                        <>
                          <span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14 }} />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={15} />
                          Upload Academy Logo
                        </>
                      )}
                    </label>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>JPG, PNG or GIF. Max size 500KB.</div>
                  </div>
                </div>
              </div>

              <div style={fieldRowStyle}>
                <div style={fieldColStyle}>
                  <label htmlFor="full_name" style={fieldLabelStyle}><User size={14} /> Full Name</label>
                  <input
                    type="text" id="full_name" name="full_name"
                    value={formData.full_name} onChange={handleInputChange}
                    placeholder="Enter your full name" style={inputStyle}
                  />
                </div>
                <div style={fieldColStyle}>
                  <label htmlFor="email" style={fieldLabelStyle}><Mail size={14} /> Email Address</label>
                  <input
                    type="email" id="email" name="email"
                    value={formData.email} disabled
                    style={{ ...inputStyle, background: 'var(--surface-soft)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                  />
                  <div style={fieldHintStyle}>Email cannot be changed</div>
                </div>
              </div>

              <div style={fieldRowStyle}>
                <div style={fieldColStyle}>
                  <label htmlFor="institution" style={fieldLabelStyle}><University size={14} /> Institution</label>
                  <input
                    type="text" id="institution" name="institution"
                    value={formData.institution} onChange={handleInputChange}
                    placeholder="Enter your institution" style={inputStyle}
                  />
                </div>
                <div style={fieldColStyle}>
                  <label htmlFor="cellno" style={fieldLabelStyle}><Phone size={14} /> Phone Number</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="tel" id="cellno" name="cellno"
                      value={formData.cellno} onChange={handleInputChange}
                      placeholder="0300-1234567" maxLength={12}
                      style={{
                        ...inputStyle,
                        paddingRight: 34,
                        borderColor: cellnoStatus === 'invalid' ? '#ef4444' : cellnoStatus === 'valid' ? '#22c55e' : 'var(--border-subtle)',
                        boxShadow: !profile?.cellno && !formData.cellno ? '0 0 0 3px rgba(245,158,11,0.12)' : 'none',
                      }}
                    />
                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                      {cellnoStatus === 'checking' && <span className="spinner-border spinner-border-sm text-primary" style={{ width: 14, height: 14 }} />}
                      {cellnoStatus === 'valid' && <CheckCircle size={16} style={{ color: '#22c55e' }} />}
                      {cellnoStatus === 'invalid' && <AlertCircle size={16} style={{ color: '#ef4444' }} />}
                    </div>
                  </div>
                  <div style={{ ...fieldHintStyle, color: cellnoStatus === 'invalid' ? '#ef4444' : cellnoStatus === 'valid' ? '#16a34a' : 'var(--text-muted)' }}>
                    {cellnoStatus === 'invalid' ? "Phone number is invalid or already registered" :
                     cellnoStatus === 'valid' ? "Phone number is available" :
                     "11-digit number starting with 03 (e.g., 03001234567)"}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1.1rem' }}>
                <label htmlFor="address" style={fieldLabelStyle}><MapPin size={14} /> Postal Address</label>
                <textarea
                  id="address" name="address" rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter your complete academy or personal address"
                  style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={!!(saving || (formData.cellno && formData.cellno !== profile?.cellno && cellnoStatus !== 'valid'))}
                  style={{
                    ...primaryBtnStyle,
                    opacity: (saving || (!!formData.cellno && formData.cellno !== profile?.cellno && cellnoStatus !== 'valid')) ? 0.6 : 1,
                    cursor: (saving || (!!formData.cellno && formData.cellno !== profile?.cellno && cellnoStatus !== 'valid')) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14 }} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Package status */}
          {statusInfo && (
            <div style={{
              background: toneColors[statusInfo.tone].bg,
              border: `1px solid ${toneColors[statusInfo.tone].border}`,
              borderRadius: 'var(--radius-xl)', padding: '1.1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <statusInfo.icon size={17} style={{ color: toneColors[statusInfo.tone].fg }} />
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: toneColors[statusInfo.tone].fg }}>
                  {statusInfo.title}
                </span>
              </div>
              {statusInfo.lines.map((line, i) => (
                <p key={i} style={{ margin: '2px 0 0', fontSize: '0.8rem', color: toneColors[statusInfo.tone].fg, opacity: 0.88 }}>
                  {line}
                </p>
              ))}
            </div>
          )}

          {/* Account info */}
          <div style={{
            background: '#fff', borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
          }}>
            <div style={{ padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Account Information</h3>
            </div>
            <div style={{ padding: '0.6rem 0.6rem' }}>
              {profile && [
                { icon: User, label: 'Account Role', value: profile.role, color: 'var(--brand-primary)' },
                { icon: Calendar, label: 'Member Since', value: new Date(profile.created_at).toLocaleDateString(), color: '#16a34a' },
                { icon: Save, label: 'Last Updated', value: new Date(profile.updated_at).toLocaleDateString(), color: 'var(--brand-accent)' },
                { icon: Package, label: 'Subscription', value: profile.subscription_status || 'inactive', color: '#f59e0b' },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.55rem' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <row.icon size={15} style={{ color: row.color }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{row.label}</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', textTransform: 'capitalize' }}>{row.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 900px) {
          .settings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const fieldRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' };
const fieldColStyle: React.CSSProperties = { minWidth: 0 };
const fieldLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 6,
};
const fieldHintStyle: React.CSSProperties = { fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-subtle)', fontSize: '0.88rem', fontFamily: 'inherit',
  outline: 'none', color: 'var(--text-main)', background: '#fff',
};
const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.6rem 1.5rem', border: 'none',
  borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.88rem', color: '#fff', fontFamily: 'inherit',
  background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
  boxShadow: '0 4px 12px rgba(7,62,140,0.2)',
};
const secondaryBtnStyle: React.CSSProperties = {
  alignItems: 'center', gap: 8, padding: '0.5rem 1rem', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.82rem', color: 'var(--brand-primary)',
  background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
};
