'use client';
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { isUserAdmin } from "@/lib/auth-utils";
import { useRouter } from 'next/navigation';
import toast from "react-hot-toast";
import {
  Search, Plus, Eye, Pencil, Trash2, Users as UsersIcon,
  GraduationCap, Home, ShieldCheck, UserCircle2, Ban, Unlock
} from "lucide-react";
import './users.css';

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
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

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchesSearch =
        p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || p.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [profiles, search, roleFilter]);

  const kpis = useMemo(() => ({
    total: profiles.length,
    teachers: profiles.filter(p => p.role === 'teacher').length,
    academies: profiles.filter(p => p.role === 'academy').length,
    active: profiles.filter(p => p.subscription_status === 'active').length,
  }), [profiles]);

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / perPage));
  const paginatedProfiles = filteredProfiles.slice((page - 1) * perPage, page * perPage);

  const initials = (name?: string) => (name?.trim()?.charAt(0) || "U").toUpperCase();

  const deleteUser = async (id: string) => {
    const confirmed = window.confirm("⚠️ Do you really want to delete this user?\n\nThis action cannot be undone.");
    if (!confirmed) return;

    const toastId = toast.loading("Deleting user...");
    try {
      const res = await fetch(`/api/admin/profiles/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      setProfiles((prev) => prev.filter((x) => x.id !== id));
      toast.success("User deleted successfully", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Delete failed", { id: toastId });
    }
  };

  const toggleDisabled = async (id: string, currentlyDisabled: boolean) => {
    const nextState = !currentlyDisabled;
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
      setProfiles((prev) => prev.map((x) => (x.id === id ? { ...x, is_disabled: nextState } : x)));
      toast.success(nextState ? "User disabled" : "User re-enabled", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Update failed", { id: toastId });
    }
  };

  if (loading) {
    return (
      <AdminLayout activeTab="users">
        <div className="usr">
          <div className="usr-loadwrap">
            <div className="usr-spin" />
            <p>Checking access…</p>
          </div>
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
      <div className="usr">
        <div className="usr-hd">
          <div>
            <div className="usr-eyebrow"><span className="usr-eyebrow-dot" />User management</div>
            <h1>Teachers, Academies &amp; Students</h1>
            <p>Every account on the platform — search, filter, and manage access in one place.</p>
          </div>
          <Link href="/admin/users/new" className="usr-btn usr-btn-primary">
            <Plus size={15} /> Add new user
          </Link>
        </div>

        <div className="usr-kpi-grid">
          <div className="usr-kpi">
            <div className="usr-kpi-icon usr-kpi-icon--blue"><UsersIcon size={18} /></div>
            <div><p className="usr-kpi-label">Total users</p><h2 className="usr-kpi-value">{kpis.total.toLocaleString()}</h2></div>
          </div>
          <div className="usr-kpi">
            <div className="usr-kpi-icon usr-kpi-icon--green"><GraduationCap size={18} /></div>
            <div><p className="usr-kpi-label">Teachers</p><h2 className="usr-kpi-value">{kpis.teachers.toLocaleString()}</h2></div>
          </div>
          <div className="usr-kpi">
            <div className="usr-kpi-icon usr-kpi-icon--violet"><Home size={18} /></div>
            <div><p className="usr-kpi-label">Academies</p><h2 className="usr-kpi-value">{kpis.academies.toLocaleString()}</h2></div>
          </div>
          <div className="usr-kpi">
            <div className="usr-kpi-icon usr-kpi-icon--amber"><ShieldCheck size={18} /></div>
            <div><p className="usr-kpi-label">Active subs</p><h2 className="usr-kpi-value">{kpis.active.toLocaleString()}</h2></div>
          </div>
        </div>

        <div className="usr-filters">
          <div className="usr-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="usr-select"
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All roles</option>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="academy">Academy</option>
            <option value="admin">Admin</option>
          </select>
          <select
            className="usr-select"
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
          >
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} per page</option>)}
          </select>
        </div>

        <div className="usr-card">
          <div className="usr-table-wrap">
            <table className="usr-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Login</th>
                  <th>Papers</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProfiles.length > 0 ? (
                  paginatedProfiles.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="usr-person">
                          {p.logo ? (
                            <img src={p.logo} alt="" className="usr-avatar" />
                          ) : (
                            <div className="usr-avatar">{initials(p.full_name)}</div>
                          )}
                          <div>
                            <div className="usr-person-name">{p.full_name || "—"}</div>
                            <div className="usr-person-email">{p.email || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={`usr-badge usr-badge--${p.role}`}>{p.role}</span></td>
                      <td>{p.login_method || 'email'}</td>
                      <td>{p.papers_generated ?? 0}</td>
                      <td>
                        {p.is_disabled ? (
                          <span className="usr-badge usr-badge--disabled">Disabled</span>
                        ) : (
                          <span className={`usr-badge usr-badge--${p.subscription_status}`}>{p.subscription_status || 'inactive'}</span>
                        )}
                      </td>
                      <td>
                        <div className="usr-actions">
                          <Link href={`/admin/users/${p.id}`} className="usr-icon-btn" title="View" aria-label="View">
                            <Eye size={14} />
                          </Link>
                          <Link href={`/admin/users/${p.id}/edit`} className="usr-icon-btn" title="Edit" aria-label="Edit">
                            <Pencil size={14} />
                          </Link>
                          <button
                            className="usr-icon-btn"
                            title={p.is_disabled ? "Re-enable user" : "Disable user"}
                            aria-label={p.is_disabled ? "Re-enable user" : "Disable user"}
                            onClick={() => toggleDisabled(p.id, !!p.is_disabled)}
                          >
                            {p.is_disabled ? <Unlock size={14} /> : <Ban size={14} />}
                          </button>
                          <button
                            className="usr-icon-btn usr-icon-btn--danger"
                            title="Delete"
                            aria-label="Delete"
                            onClick={() => deleteUser(p.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="usr-empty">
                        <UserCircle2 size={34} />
                        <p>No users match your filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="usr-pagination">
              <button className="usr-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  className={`usr-page-btn ${page === i + 1 ? 'is-active' : ''}`}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button className="usr-page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
