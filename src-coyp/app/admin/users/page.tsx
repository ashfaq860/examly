'use client';
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { isUserAdmin } from "@/lib/auth-utils";
import { useRouter } from 'next/navigation';
import toast from "react-hot-toast";

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function init() {
      setLoading(true);
      const admin = await isUserAdmin();
      if (!admin) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setAuthorized(true);

      const res = await fetch("/api/admin/profiles");
      const data = await res.json();
      setProfiles(data);
      setLoading(false);
    }
    init();
  }, []);

  // Filter + Search
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchesSearch =
        p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || p.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [profiles, search, roleFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredProfiles.length / perPage);
  const paginatedProfiles = filteredProfiles.slice(
    (page - 1) * perPage,
    page * perPage
  );

  if (loading) {
    return (
      <AdminLayout activeTab="users">
        <div className="container-fluid py-5 text-center">
          <div className="spinner-border text-primary" style={{ width: "3rem", height: "3rem" }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Checking access...</p>
        </div>
      </AdminLayout>
    );
  }

  if (!authorized) {
    router.push('/unauthorized');
    return null;
  }

  return (
    <AdminLayout activeTab="users">
      <div className="container mt-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3">
          <h2 className="mb-3 mb-md-0">Profiles Management</h2>
          <Link href="/admin/users/new" className="btn btn-success shadow-sm">
            + Add New User
          </Link>
        </div>

        {/* Filters */}
        <div className="card shadow-sm mb-3">
          <div className="card-body row g-2 align-items-center">
            <div className="col-md-4">
              <input
                type="text"
                className="form-control"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Roles</option>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="academy">Academy</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[5,10,20,50,100].map(n => <option key={n} value={n}>{n} per page</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive shadow-sm">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Login Method</th>
                <th>Papers Generated</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProfiles.length > 0 ? (
                paginatedProfiles.map((p,i) => (
                  <tr key={p.id}>
                    <td>{(page-1)*perPage + i + 1}</td>
                    <td><strong>{p.full_name || "—"}</strong></td>
                    <td>{p.email || "—"}</td>
                    <td><span className="badge bg-secondary">{p.role}</span></td>
                    <td>{p.login_method || 'email'}</td>
                    <td>{p.papers_generated ?? 0}</td>
                    <td>
                      {p.subscription_status === "active" && <span className="badge bg-success">Active</span>}
                      {p.subscription_status === "inactive" && <span className="badge bg-secondary">Inactive</span>}
                      {p.subscription_status === "canceled" && <span className="badge bg-danger">Canceled</span>}
                      {p.subscription_status === "trialing" && <span className="badge bg-warning text-dark">Trialing</span>}
                    </td>
                    <td>
                      <Link href={`/admin/users/${p.id}`} className="btn btn-sm btn-outline-info me-2">View</Link>
                      <Link href={`/admin/users/${p.id}/edit`} className="btn btn-sm btn-outline-primary me-2">Edit</Link>
                      <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={async () => {
                            const confirmed = window.confirm(
                              "⚠️ Do you really want to delete this user?\n\nThis action cannot be undone."
                            );
                            if (!confirmed) return;

                            const toastId = toast.loading("Deleting user...");

                            try {
                              const res = await fetch(`/api/admin/profiles/${p.id}`, {
                                method: "DELETE",
                              });

                              const data = await res.json();

                              if (!res.ok) {
                                throw new Error(data.error || "Failed to delete user");
                              }

                              // Remove from UI only after success
                              setProfiles((prev) => prev.filter((x) => x.id !== p.id));

                              toast.success("User deleted successfully", { id: toastId });
                            } catch (err: any) {
                              toast.error(err.message || "Delete failed", { id: toastId });
                            }
                          }}
                        >
                          Delete
                        </button>

                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-muted">
                    No profiles found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="mt-3">
            <ul className="pagination justify-content-center">
              <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setPage(p => p - 1)}>Previous</button>
              </li>
              {Array.from({ length: totalPages }, (_, i) => (
                <li key={i} className={`page-item ${page === i + 1 ? "active" : ""}`}>
                  <button className="page-link" onClick={() => setPage(i + 1)}>{i + 1}</button>
                </li>
              ))}
              <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setPage(p => p + 1)}>Next</button>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </AdminLayout>
  );
}
