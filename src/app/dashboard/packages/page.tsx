'use client';

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import Loading from '@/app/dashboard/generate-paper/loading';
import toast from 'react-hot-toast';
import {
  Gem, CheckCircle2, Clock, FileText, Sparkles, Droplet, Zap, Rocket, BadgeCheck, Hourglass,
} from 'lucide-react';

const supabase = createSupabaseBrowserClient();

interface Package {
  id: string;
  name: string;
  type: 'paper_pack' | 'subscription';
  paper_quantity?: number;
  duration_days?: number;
  price: number;
  description: string;
}

interface UserPackage {
  id: string;
  package_id: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  papers_remaining: number | null;
  packages: Package;
}

const BENEFITS = [
  { icon: Sparkles, title: "Unlimited Papers", desc: "Create and access unlimited question papers with complete control. Generate, edit, and manage papers freely without any restrictions." },
  { icon: Droplet, title: "Watermark Control", desc: "Use your own custom watermark or remove it completely. Print professional-looking papers exactly the way you want." },
  { icon: Zap, title: "Priority Support", desc: "Premium users get fast and dedicated support. Our team is always available to assist you whenever you need help." },
  { icon: Rocket, title: "Advanced Features", desc: "Unlock full access to advanced paper-generation tools, complete customization options, and powerful controls for professionals." },
];

export default function SubscriptionPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState<UserPackage[]>([]);
  const [inactiveSubscriptions, setInactiveSubscriptions] = useState<UserPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPackages();
    fetchUserSubscriptions();
  }, []);

  const fetchPackages = async () => {
    try {
      const res = await fetch("/api/subscriptions");
      if (!res.ok) throw new Error("Failed to fetch packages");
      const data = await res.json();
      setPackages(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUserSubscriptions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/subscriptions/${session.user.id}`);
      if (!res.ok) throw new Error("Failed to fetch user subscriptions");
      const data = await res.json();

      const now = new Date();
      const activeSubs = (data || []).filter(
        (sub: UserPackage) =>
          sub.is_active && (!sub.expires_at || new Date(sub.expires_at) > now)
      );
      const inactiveSubs = (data || []).filter(
        (sub: UserPackage) => !sub.is_active && !sub.expires_at
      );

      setActiveSubscriptions(activeSubs);
      setInactiveSubscriptions(inactiveSubs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (packageId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to subscribe");
        return;
      }

      setSubscribingId(packageId);
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, packageId }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to submit subscription request");

      setInactiveSubscriptions((prev) => [...prev, result]);
      toast.success("Subscription request submitted! Pending admin approval.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit subscription request.");
    } finally {
      setSubscribingId(null);
    }
  };

  if (loading) {
    return (
      <div className="container text-center py-5">
        <Loading />
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-xl)',
        background: 'linear-gradient(135deg, #073e8c 0%, #0b63d4 55%, #1ba699 100%)',
        padding: '2.75rem 1.5rem', textAlign: 'center', color: '#fff', marginBottom: '2rem',
        boxShadow: '0 12px 32px rgba(7,62,140,0.25)',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -30, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.3rem 0.85rem',
            background: 'rgba(255,255,255,0.15)', borderRadius: 99, fontSize: '0.78rem', fontWeight: 700,
            marginBottom: '1rem',
          }}>
            <Gem size={14} /> Premium Plans
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.6rem' }}>Choose Your Plan</h1>
          <p style={{ fontSize: '0.95rem', opacity: 0.9, margin: '0 0 1.5rem' }}>
            Unlock unlimited paper generation for all board classes 5th–12th with flexible subscription packages.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#plans" style={heroBtnPrimary}>View Plans</a>
            <a href="#benefits" style={heroBtnOutline}>Why Subscribe?</a>
          </div>
        </div>
      </div>

      {/* Active subscriptions */}
      {activeSubscriptions.length > 0 && (
        <div style={{ ...bannerStyle, background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', borderColor: '#a7f3d0', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <BadgeCheck size={18} style={{ color: '#065f46' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#065f46' }}>Active Subscriptions</h4>
          </div>
          {activeSubscriptions.map((sub) => (
            <div key={sub.id} style={{ fontSize: '0.85rem', color: '#065f46', marginBottom: 6 }}>
              <strong>{sub.packages.name}</strong> — Expires on{' '}
              {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "N/A"}
              {sub.packages.type === "paper_pack" && <> · Papers remaining: {sub.papers_remaining}</>}
            </div>
          ))}
        </div>
      )}

      {/* Pending subscriptions */}
      {inactiveSubscriptions.length > 0 && (
        <div style={{ ...bannerStyle, background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderColor: '#bfdbfe', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Hourglass size={18} style={{ color: 'var(--brand-primary)' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand-primary)' }}>Pending Subscriptions</h4>
          </div>
          {inactiveSubscriptions.map((sub) => (
            <div key={sub.id} style={{ fontSize: '0.85rem', color: 'var(--brand-primary)', marginBottom: 4 }}>
              <strong>{sub.packages?.name || "Unknown Package"}</strong> — Waiting for admin approval
              <div style={{ fontSize: '0.76rem', opacity: 0.75 }}>Requested on {new Date(sub.created_at).toLocaleDateString()}</div>
            </div>
          ))}
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--brand-primary)', opacity: 0.85 }}>
            You will be contacted soon to complete your subscription activation.
          </p>
        </div>
      )}

      {/* Plans */}
      <h2 id="plans" style={{ textAlign: 'center', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.5rem' }}>
        Our Subscription Plans
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        {packages.map((pkg) => {
          const isActive = activeSubscriptions.some((sub) => sub.package_id === pkg.id);
          const isPending = inactiveSubscriptions.some((sub) => sub.package_id === pkg.id);
          const isSubscribing = subscribingId === pkg.id;

          return (
            <div
              key={pkg.id}
              style={{
                display: 'flex', flexDirection: 'column', background: '#fff',
                borderRadius: 'var(--radius-xl)', border: isActive ? '2px solid #16a34a' : '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)', overflow: 'hidden', transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <div style={{ padding: '1.5rem 1.25rem', textAlign: 'center', flex: 1 }}>
                <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>{pkg.name}</h3>
                <div style={{
                  fontSize: '1.7rem', fontWeight: 800, margin: '0 0 0.6rem',
                  background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  PKR {pkg.price}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.9rem' }}>{pkg.description}</p>
                {pkg.type === "paper_pack" && pkg.paper_quantity && (
                  <span style={pillStyle('rgba(27,166,153,0.1)', 'var(--brand-accent)')}>
                    <FileText size={12} /> {pkg.paper_quantity} Papers
                  </span>
                )}
                {pkg.type === "subscription" && pkg.duration_days && (
                  <span style={pillStyle('rgba(22,163,74,0.1)', '#16a34a')}>
                    <Clock size={12} /> {pkg.duration_days} Days Access
                  </span>
                )}
              </div>
              <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => handleSubscribe(pkg.id)}
                  disabled={isActive || isPending || isSubscribing}
                  style={{
                    width: '100%', padding: '0.6rem', border: 'none', borderRadius: 'var(--radius-md)',
                    fontWeight: 700, fontSize: '0.85rem', color: '#fff', fontFamily: 'inherit',
                    cursor: (isActive || isPending || isSubscribing) ? 'not-allowed' : 'pointer',
                    opacity: (isActive || isPending) ? 0.85 : 1,
                    background: isActive
                      ? '#16a34a'
                      : isPending
                        ? '#94a3b8'
                        : 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
                  }}
                >
                  {isActive ? "✓ Active" : isPending ? "Pending Approval" : isSubscribing ? "Submitting..." : "Subscribe Now"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Benefits */}
      <div id="benefits" style={{
        background: 'var(--surface-soft)', borderRadius: 'var(--radius-xl)', padding: '2.25rem 1.5rem',
      }}>
        <h3 style={{ textAlign: 'center', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.5rem' }}>
          Why Subscribe?
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {BENEFITS.map((item, i) => (
            <div key={i} style={{
              background: '#fff', borderRadius: 'var(--radius-lg)', padding: '1.1rem',
              border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, marginBottom: 10,
                background: 'linear-gradient(135deg, var(--brand-primary-50) 0%, rgba(27,166,153,0.1) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <item.icon size={18} style={{ color: 'var(--brand-primary)' }} />
              </div>
              <h4 style={{ margin: '0 0 6px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>{item.title}</h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const bannerStyle: React.CSSProperties = {
  borderRadius: 'var(--radius-xl)', border: '1px solid', padding: '1.1rem 1.25rem',
};

const heroBtnPrimary: React.CSSProperties = {
  padding: '0.6rem 1.4rem', background: '#fff', color: 'var(--brand-primary)',
  borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.85rem',
  textDecoration: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
};

const heroBtnOutline: React.CSSProperties = {
  padding: '0.6rem 1.4rem', background: 'transparent', color: '#fff',
  border: '1.5px solid rgba(255,255,255,0.6)', borderRadius: 'var(--radius-md)',
  fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none',
};

const pillStyle = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
  borderRadius: 99, fontSize: '0.74rem', fontWeight: 700, background: bg, color,
});
