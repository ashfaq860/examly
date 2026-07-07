"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";
import { isUserAdmin } from "@/lib/auth-utils";
import toast from "react-hot-toast";
import {
  ArrowLeft, Pencil, Phone, Building2, BookMarked, FileText,
  CalendarClock, CalendarPlus, History, BarChart3, UserCircle2, Ban, Unlock
} from "lucide-react";
import '../users.css';

export default function ViewProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function init() {
      setLoading(true);
      const admin = await isUserAdmin();
      if (!admin) {
        setAuthorized(false);
        router.replace("/unauthorized");
        return;
      }
      setAuthorized(true);
      setLoading(false);
    }
    init();
  }, [router]);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setProfileLoading(true);
        const res = await fetch(`/api/admin/profiles/${id}`);
        if (!res.ok) {
          setProfile(null);
        } else {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    }
    if (id && authorized) {
      fetchProfile();
    }
  }, [id, authorized]);

  if (loading || authorized === null || profileLoading) {
    return (
      <AdminLayout activeTab="users">
        <div className="usr">
          <div className="usr-loadwrap">
            <div className="usr-spin" />
            <p>Loading profile…</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!profile) {
    return (
      <AdminLayout activeTab="users">
        <div className="usr">
          <div className="usr-empty">
            <UserCircle2 size={34} />
            <p>Profile not found</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const initials = (profile.full_name?.trim()?.charAt(0) || "U").toUpperCase();
  const papersBySubject: { class_name: string; subject_name: string; count: number }[] = profile.papersBySubject || [];
  const maxSubjectCount = Math.max(1, ...papersBySubject.map((s) => s.count));

  const toggleDisabled = async () => {
    const nextState = !profile.is_disabled;
    const confirmed = window.confirm(
      nextState
        ? "Disable this user? They'll be signed out and blocked from logging in until re-enabled."
        : "Re-enable this user? They'll be able to log in again."
    );
    if (!confirmed) return;

    const toastId = toast.loading(nextState ? "Disabling user..." : "Enabling user...");
    try {
      const res = await fetch(`/api/admin/profiles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_disabled: nextState }),
      });
      if (!res.ok) throw new Error("Failed to update user");
      setProfile((prev: any) => ({ ...prev, is_disabled: nextState }));
      toast.success(nextState ? "User disabled" : "User re-enabled", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Update failed", { id: toastId });
    }
  };

  return (
    <AdminLayout activeTab="users">
      <div className="usr">
        <button className="usr-back" onClick={() => history.back()}>
          <ArrowLeft size={15} /> Back to users
        </button>

        <div className="usr-profile-hd">
          {profile.logo ? (
            <img src={profile.logo} alt="" className="usr-profile-avatar" />
          ) : (
            <div className="usr-profile-avatar">{initials}</div>
          )}
          <div>
            <h2>{profile.full_name || "Unnamed user"}</h2>
            <p className="usr-profile-email">{profile.email}</p>
            <div className="usr-profile-badges">
              <span className={`usr-badge usr-badge--${profile.role}`}>{profile.role}</span>
              {profile.is_disabled ? (
                <span className="usr-badge usr-badge--disabled">Disabled</span>
              ) : (
                <span className={`usr-badge usr-badge--${profile.subscription_status || 'inactive'}`}>
                  {profile.subscription_status || 'inactive'}
                </span>
              )}
            </div>
          </div>
          <div className="usr-profile-actions">
            <button
              className={`usr-btn ${profile.is_disabled ? 'usr-btn-ghost' : 'usr-btn-danger-ghost'}`}
              onClick={toggleDisabled}
            >
              {profile.is_disabled ? <Unlock size={15} /> : <Ban size={15} />}
              {profile.is_disabled ? 'Re-enable user' : 'Disable user'}
            </button>
            <Link className="usr-btn usr-btn-primary" href={`/admin/users/${id}/edit`}>
              <Pencil size={15} /> Edit profile
            </Link>
          </div>
        </div>

        <div className="usr-grid">
          <div className="usr-card">
            <div className="usr-card-hd"><h3><Phone size={15} /> User information</h3></div>
            <div className="usr-card-body">
              <dl className="usr-info-row"><dt>Cell no</dt><dd>{profile.cellno || "N/A"}</dd></dl>
              <dl className="usr-info-row"><dt><Building2 size={13} style={{ marginRight: 5, verticalAlign: -2 }} />Institution</dt><dd>{profile.institution || "N/A"}</dd></dl>
              <dl className="usr-info-row"><dt><BookMarked size={13} style={{ marginRight: 5, verticalAlign: -2 }} />Subjects taught</dt><dd>{profile.subjects?.length ? profile.subjects.join(", ") : "N/A"}</dd></dl>
              <dl className="usr-info-row"><dt><FileText size={13} style={{ marginRight: 5, verticalAlign: -2 }} />Papers generated</dt><dd>{profile.totalPapersGenerated ?? profile.papers_generated ?? 0}</dd></dl>
            </div>
          </div>

          <div className="usr-card">
            <div className="usr-card-hd"><h3><History size={15} /> Subscription details</h3></div>
            <div className="usr-card-body">
              <dl className="usr-info-row"><dt><CalendarClock size={13} style={{ marginRight: 5, verticalAlign: -2 }} />Trial ends at</dt><dd>{profile.trial_ends_at ? new Date(profile.trial_ends_at).toLocaleDateString() : "N/A"}</dd></dl>
              <dl className="usr-info-row"><dt><CalendarPlus size={13} style={{ marginRight: 5, verticalAlign: -2 }} />Created at</dt><dd>{profile.created_at ? new Date(profile.created_at).toLocaleString() : "N/A"}</dd></dl>
              <dl className="usr-info-row"><dt>Last updated</dt><dd>{profile.updated_at ? new Date(profile.updated_at).toLocaleString() : "N/A"}</dd></dl>
            </div>
          </div>
        </div>

        <div className="usr-card">
          <div className="usr-card-hd"><h3><BarChart3 size={15} /> Papers generated by class &amp; subject</h3></div>
          <div className="usr-card-body">
            {papersBySubject.length ? (
              papersBySubject.map((s) => (
                <div className="usr-subject-row" key={`${s.class_name}::${s.subject_name}`}>
                  <span className="usr-subject-label" title={`${s.class_name} — ${s.subject_name}`}>
                    <span className="usr-subject-class">{s.class_name}</span>
                    <span className="usr-subject-name">{s.subject_name}</span>
                  </span>
                  <div className="usr-subject-track">
                    <div className="usr-subject-fill" style={{ width: `${(s.count / maxSubjectCount) * 100}%` }} />
                  </div>
                  <span className="usr-subject-count">{s.count}</span>
                </div>
              ))
            ) : (
              <div className="usr-empty">
                <FileText size={28} />
                <p>No papers generated yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
