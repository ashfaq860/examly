"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { SubjectsMultiSelect, SubjectOption, buildSubjectOptions } from "@/components/admin/SubjectsMultiSelect";
import { isUserAdmin } from "@/lib/auth-utils";
import { ArrowLeft, Save, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import '../../users.css';

export default function EditProfile() {
  const { id } = useParams();
  const router = useRouter();

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const admin = await isUserAdmin();
        setAuthorized(admin);
      } catch (err) {
        console.error("Admin check failed", err);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (authorized === false && !loading) {
      router.replace("/unauthorized");
    }
  }, [authorized, loading, router]);

  useEffect(() => {
    async function fetchProfile() {
      const res = await fetch(`/api/admin/profiles/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    }
    if (id && authorized) fetchProfile();
  }, [id, authorized]);

  useEffect(() => {
    async function fetchSubjects() {
      const res = await fetch('/api/admin/lookups');
      if (res.ok) {
        const data = await res.json();
        setSubjectOptions(buildSubjectOptions(data.subjects || [], data.classSubjects || []));
      }
    }
    if (authorized) fetchSubjects();
  }, [authorized]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading("Saving changes...");
    try {
      const res = await fetch(`/api/admin/profiles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error("Failed to save changes");
      toast.success("Profile updated", { id: toastId });
      router.push("/admin/users");
    } catch (err: any) {
      toast.error(err.message || "Save failed", { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  if (loading || authorized === null || !profile) {
    return (
      <AdminLayout activeTab="users">
        <div className="usr">
          <div className="usr-loadwrap">
            <div className="usr-spin" />
            <p>{authorized === false ? "Redirecting…" : "Loading profile data…"}</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="users">
      <div className="usr">
        <button className="usr-back" onClick={() => router.push("/admin/users")}>
          <ArrowLeft size={15} /> Back to users
        </button>

        <div className="usr-hd">
          <div>
            <div className="usr-eyebrow"><span className="usr-eyebrow-dot" />User management</div>
            <h1><Pencil size={20} style={{ verticalAlign: -3, marginRight: 6 }} />Edit profile</h1>
            <p>Update {profile.full_name || "this user"}'s account details.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="usr-form-card">
          <div className="usr-form-grid">
            <div className="usr-field">
              <label>Full name</label>
              <input
                type="text"
                value={profile.full_name || ""}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                required
              />
            </div>

            <div className="usr-field">
              <label>Email</label>
              <input
                type="email"
                value={profile.email || ""}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                required
              />
            </div>

            <div className="usr-field">
              <label>Role</label>
              <select
                value={profile.role || "student"}
                onChange={(e) => setProfile({ ...profile, role: e.target.value })}
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="academy">Academy</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="usr-field">
              <label>Subscription status</label>
              <select
                value={profile.subscription_status || "inactive"}
                onChange={(e) => setProfile({ ...profile, subscription_status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>

            <div className="usr-field">
              <label>Cell number</label>
              <input
                type="text"
                value={profile.cellno || ""}
                onChange={(e) => setProfile({ ...profile, cellno: e.target.value })}
              />
            </div>

            <div className="usr-field">
              <label>Institution</label>
              <input
                type="text"
                value={profile.institution || ""}
                onChange={(e) => setProfile({ ...profile, institution: e.target.value })}
              />
            </div>

            <div className="usr-field usr-field-full">
              <label>Subjects</label>
              <SubjectsMultiSelect
                subjects={subjectOptions}
                value={profile.subjects || []}
                onChange={(subjects) => setProfile({ ...profile, subjects })}
              />
            </div>

            <div className="usr-field">
              <label>Logo URL</label>
              <input
                type="url"
                value={profile.logo || ""}
                onChange={(e) => setProfile({ ...profile, logo: e.target.value })}
              />
              {profile.logo && <img src={profile.logo} alt="Logo" className="usr-logo-preview" />}
            </div>

            <div className="usr-field">
              <label>Trial ends at</label>
              <input
                type="date"
                value={profile.trial_ends_at ? profile.trial_ends_at.split("T")[0] : ""}
                onChange={(e) => setProfile({ ...profile, trial_ends_at: e.target.value })}
              />
            </div>

            <div className="usr-field">
              <label>Papers generated</label>
              <input type="number" value={profile.papers_generated || 0} readOnly />
              <span className="usr-hint">Read-only — tracked automatically</span>
            </div>
          </div>

          <div className="usr-form-actions">
            <button type="button" className="usr-btn usr-btn-ghost" onClick={() => router.push("/admin/users")}>
              Cancel
            </button>
            <button type="submit" className="usr-btn usr-btn-primary" disabled={saving}>
              <Save size={15} /> {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
