"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { isUserAdmin } from "@/lib/auth-utils";

export default function EditProfile() {
  const { id } = useParams();
  const router = useRouter();

  const [authorized, setAuthorized] = useState<boolean | null>(null); // null = unknown
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // ✅ Check if user is admin
  useEffect(() => {
    async function init() {
      try {
        const admin = await isUserAdmin();
        if (!admin) {
          setAuthorized(false);
        } else {
          setAuthorized(true);
        }
      } catch (err) {
        console.error("Admin check failed", err);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // ✅ Redirect if check finished and unauthorized
  useEffect(() => {
    if (authorized === false && !loading) {
      router.replace("/unauthorized");
    }
  }, [authorized, loading, router]);

  // ✅ Fetch profile
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/admin/profiles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    router.push("/admin/users");
  }

  // ✅ Show loader while checking admin or fetching profile
  if (loading || authorized === null || !profile) {
    return (
      <AdminLayout activeTab="users">
        <div className="container-fluid py-4">
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ minHeight: "60vh" }}
          >
            <div className="text-center">
              <div
                className="spinner-border text-primary"
                style={{ width: "3rem", height: "3rem" }}
                role="status"
              >
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3">
                {authorized === false
                  ? "Redirecting..."
                  : "Loading profile data..."}
              </p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="users">
      <div className="container mt-4">
        <div className="card shadow-lg border-0 rounded-3">
          <div className="card-body p-4">
            <h2 className="mb-4 text-primary">✏️ Edit Profile</h2>
            <form onSubmit={handleSubmit} className="row g-3">
              {/* Full Name */}
              <div className="col-md-6">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={profile.full_name || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, full_name: e.target.value })
                  }
                  required
                />
              </div>

              {/* Email */}
              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={profile.email || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, email: e.target.value })
                  }
                  required
                />
              </div>

              {/* Role */}
              <div className="col-md-4">
                <label className="form-label">Role</label>
                <select
                  className="form-select"
                  value={profile.role || "student"}
                  onChange={(e) =>
                    setProfile({ ...profile, role: e.target.value })
                  }
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="academy">Academy</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Subscription Status */}
              <div className="col-md-4">
                <label className="form-label">Subscription Status</label>
                <select
                  className="form-select"
                  value={profile.subscription_status || "inactive"}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      subscription_status: e.target.value,
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>

              {/* Cell Number */}
              <div className="col-md-4">
                <label className="form-label">Cell Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={profile.cellno || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, cellno: e.target.value })
                  }
                />
              </div>

              {/* Institution */}
              <div className="col-md-6">
                <label className="form-label">Institution</label>
                <input
                  type="text"
                  className="form-control"
                  value={profile.institution || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, institution: e.target.value })
                  }
                />
              </div>

              {/* Subjects */}
              <div className="col-md-6">
                <label className="form-label">Subjects (comma separated)</label>
                <input
                  type="text"
                  className="form-control"
                  value={profile.subjects?.join(", ") || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      subjects: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>

              {/* Logo */}
              <div className="col-md-6">
                <label className="form-label">Logo URL</label>
                <input
                  type="url"
                  className="form-control"
                  value={profile.logo || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, logo: e.target.value })
                  }
                />
                {profile.logo && (
                  <img
                    src={profile.logo}
                    alt="Logo"
                    className="img-thumbnail mt-2"
                    style={{ maxWidth: "120px" }}
                  />
                )}
              </div>

              {/* Trial Ends At */}
              <div className="col-md-6">
                <label className="form-label">Trial Ends At</label>
                <input
                  type="date"
                  className="form-control"
                  value={
                    profile.trial_ends_at
                      ? profile.trial_ends_at.split("T")[0]
                      : ""
                  }
                  onChange={(e) =>
                    setProfile({ ...profile, trial_ends_at: e.target.value })
                  }
                />
              </div>

              {/* Papers Generated (read-only) */}
              <div className="col-md-6">
                <label className="form-label">Papers Generated</label>
                <input
                  type="number"
                  className="form-control"
                  value={profile.papers_generated || 0}
                  readOnly
                />
              </div>

              {/* Buttons */}
              <div className="col-12 text-end mt-3">
                <button
                  type="button"
                  className="btn btn-secondary me-2"
                  onClick={() => router.push("/admin/users")}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "💾 Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
