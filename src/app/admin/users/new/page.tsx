"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";

export default function NewUserPage() {
  const router = useRouter();
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "student",
    subscription_status: "inactive",
    package_id: "",

    // extra profile fields
    institution: "",
    subjects: "",
    cellno: "",
    logo: "",
    trial_ends_at: "",
  });
  const [loading, setLoading] = useState(false);

  // Fetch packages
  useEffect(() => {
    async function fetchPackages() {
      const res = await fetch("/api/admin/packages");
      const data = await res.json();
      setPackages(data);
    }
    fetchPackages();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // convert subjects string → array
      const payload = {
        ...form,
        subjects: form.subjects
          ? form.subjects.split(",").map((s) => s.trim())
          : [],
      };

      const res = await fetch("/api/admin/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create user");

      router.push("/admin/users");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="container mt-4">
        <div className="card shadow-lg border-0">
          <div className="card-header bg-primary text-white">
            <h4 className="mb-0">✨ Create New User</h4>
          </div>
          <div className="card-body p-4">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                {/* Left column */}
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-bold">Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      name="full_name"
                      value={form.full_name}
                      onChange={handleChange}
                      required
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      required
                      placeholder="user@example.com"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      required
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Cell No</label>
                    <input
                      type="text"
                      className="form-control"
                      name="cellno"
                      value={form.cellno}
                      onChange={handleChange}
                      placeholder="+92 300 1234567"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Institution</label>
                    <input
                      type="text"
                      className="form-control"
                      name="institution"
                      value={form.institution}
                      onChange={handleChange}
                      placeholder="School/Academy Name"
                    />
                  </div>
                </div>

                {/* Right column */}
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-bold">Role</label>
                    <select
                      className="form-select"
                      name="role"
                      value={form.role}
                      onChange={handleChange}
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="academy">Academy</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      Subscription Status
                    </label>
                    <select
                      className="form-select"
                      name="subscription_status"
                      value={form.subscription_status}
                      onChange={handleChange}
                    >
                      <option value="inactive">Inactive</option>
                      <option value="active">Active</option>
                      <option value="trial">Trial</option>
                      <option value="canceled">Canceled</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Activate Package</label>
                    <select
                      className="form-select"
                      name="package_id"
                      value={form.package_id}
                      onChange={handleChange}
                    >
                      <option value="">-- No Package --</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} ({pkg.price} {pkg.currency})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Subjects</label>
                    <input
                      type="text"
                      className="form-control"
                      name="subjects"
                      value={form.subjects}
                      onChange={handleChange}
                      placeholder="Math, Physics, Chemistry"
                    />
                    <div className="form-text">
                      Separate multiple subjects with commas
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Logo URL</label>
                    <input
                      type="url"
                      className="form-control"
                      name="logo"
                      value={form.logo}
                      onChange={handleChange}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Trial Ends At</label>
                    <input
                      type="date"
                      className="form-control"
                      name="trial_ends_at"
                      value={form.trial_ends_at}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 d-flex justify-content-end">
                <button
                  type="submit"
                  className="btn btn-success px-4"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create User"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary ms-2 px-4"
                  onClick={() => router.push("/admin/users")}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
