"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";
import { isUserAdmin } from "@/lib/auth-utils";

export default function ViewProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true); // ✅ new state
  const router = useRouter();

  // ✅ Check admin
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

  // ✅ Fetch profile
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

  // ✅ Show loading spinner
  if (loading || authorized === null || profileLoading) {
    return (
      <AdminLayout>
        <div className="d-flex justify-content-center align-items-center vh-50">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // ✅ Only show "not found" if fetch finished but profile is still null
  if (!profile) {
    return (
      <AdminLayout>
        <div className="text-center text-muted py-5">Profile not found</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container mt-4">
        <div className="card shadow-lg border-0 rounded-3">
          <div className="card-body">
            {/* Avatar + Header */}
            <div className="d-flex align-items-center mb-4">
              {profile.logo ? (
                <img
                  src={profile.logo}
                  alt="Logo"
                  className="rounded-circle me-3"
                  width="80"
                  height="80"
                />
              ) : (
                <div
                  className="bg-secondary text-white rounded-circle d-flex justify-content-center align-items-center me-3"
                  style={{ width: 80, height: 80 }}
                >
                  <span style={{ fontSize: "1.5rem" }}>
                    {profile.full_name?.charAt(0) || "U"}
                  </span>
                </div>
              )}
              <div>
                <h3 className="mb-0">{profile.full_name}</h3>
                <p className="text-muted mb-0">{profile.email}</p>
                <span className="badge bg-info text-dark me-2">{profile.role}</span>
                <span
                  className={`badge ${
                    profile.subscription_status === "active"
                      ? "bg-success"
                      : profile.subscription_status === "inactive"
                      ? "bg-secondary"
                      : "bg-danger"
                  }`}
                >
                  {profile.subscription_status}
                </span>
              </div>
            </div>

            {/* Profile Info */}
            <div className="row g-4">
              <div className="col-md-6">
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <h5 className="card-title">User Information</h5>
                    <table className="table table-borderless">
                      <tbody>
                        <tr>
                          <th>Cell No</th>
                          <td>{profile.cellno || "N/A"}</td>
                        </tr>
                        <tr>
                          <th>Institution</th>
                          <td>{profile.institution || "N/A"}</td>
                        </tr>
                        <tr>
                          <th>Subjects</th>
                          <td>
                            {profile.subjects?.length
                              ? profile.subjects.join(", ")
                              : "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <th>Papers Generated</th>
                          <td>{profile.papers_generated}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Subscription/Trial Info */}
              <div className="col-md-6">
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <h5 className="card-title">Subscription Details</h5>
                    <table className="table table-borderless">
                      <tbody>
                        <tr>
                          <th>Trial Ends At</th>
                          <td>
                            {profile.trial_ends_at
                              ? new Date(profile.trial_ends_at).toLocaleDateString()
                              : "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <th>Created At</th>
                          <td>
                            {profile.created_at
                              ? new Date(profile.created_at).toLocaleString()
                              : "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <th>Last Updated</th>
                          <td>
                            {profile.updated_at
                              ? new Date(profile.updated_at).toLocaleString()
                              : "N/A"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="mt-4 text-end">
              <button
                className="btn btn-primary me-2"
                onClick={() => history.back()}
              >
                ← Back
              </button>
              <Link className="btn btn-warning" href={`/admin/users/${id}/edit`}>
                Edit Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
