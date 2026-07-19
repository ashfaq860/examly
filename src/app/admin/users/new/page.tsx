"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { SubjectsMultiSelect, SubjectOption, buildSubjectOptions } from "@/components/admin/SubjectsMultiSelect";
import { ArrowLeft, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import '../users.css';

export default function NewUserPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<any[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "student",
    subscription_status: "inactive",
    package_id: "",
    institution: "",
    subjects: [] as string[],
    cellno: "",
    logo: "",
    trial_ends_at: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchLookups() {
      const [pkgRes, lookupsRes] = await Promise.all([
        fetch("/api/admin/packages"),
        fetch("/api/admin/lookups"),
      ]);
      setPackages(await pkgRes.json());
      const lookups = await lookupsRes.json();
      setSubjectOptions(buildSubjectOptions(lookups.subjects || [], lookups.classSubjects || []));
    }
    fetchLookups();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading("Creating user...");

    try {
      const payload = { ...form };

      const res = await fetch("/api/admin/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create user");

      toast.success("User created successfully", { id: toastId });
      router.push("/admin/users");
    } catch (err: any) {
      toast.error(err.message || "Create failed", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout activeTab="users">
      <div className="usr">
        <button className="usr-back" onClick={() => router.push("/admin/users")}>
          <ArrowLeft size={15} /> Back to users
        </button>

        <div className="usr-hd">
          <div>
            <div className="usr-eyebrow"><span className="usr-eyebrow-dot" />User management</div>
            <h1><UserPlus size={20} style={{ verticalAlign: -3, marginRight: 6 }} />Create new user</h1>
            <p>Add a teacher, academy, or student account and optionally activate a package.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="usr-form-card">
          <div className="usr-form-grid">
            <div className="usr-field">
              <label>Full name</label>
              <input type="text" name="full_name" value={form.full_name} onChange={handleChange} required placeholder="John Doe" />
            </div>

            <div className="usr-field">
              <label>Role</label>
              <select name="role" value={form.role} onChange={handleChange}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="academy">Academy</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="usr-field">
              <label>Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="user@example.com" />
            </div>

            <div className="usr-field">
              <label>Subscription status</label>
              <select name="subscription_status" value={form.subscription_status} onChange={handleChange}>
                <option value="inactive">Inactive</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>

            <div className="usr-field">
              <label>Password</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} required placeholder="********" />
            </div>

            <div className="usr-field">
              <label>Activate package</label>
              <select name="package_id" value={form.package_id} onChange={handleChange}>
                <option value="">— No package —</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name} ({pkg.price} {pkg.currency})</option>
                ))}
              </select>
            </div>

            <div className="usr-field">
              <label>Cell no</label>
              <input type="text" name="cellno" value={form.cellno} onChange={handleChange} placeholder="+92 300 1234567" />
            </div>

            <div className="usr-field">
              <label>Subjects</label>
              <SubjectsMultiSelect
                subjects={subjectOptions}
                value={form.subjects}
                onChange={(subjects) => setForm({ ...form, subjects })}
              />
            </div>

            <div className="usr-field">
              <label>Institution</label>
              <input type="text" name="institution" value={form.institution} onChange={handleChange} placeholder="School/Academy name" />
            </div>

            <div className="usr-field">
              <label>Trial ends at</label>
              <input type="date" name="trial_ends_at" value={form.trial_ends_at} onChange={handleChange} />
            </div>

            <div className="usr-field usr-field-full">
              <label>Logo URL</label>
              <input type="url" name="logo" value={form.logo} onChange={handleChange} placeholder="https://example.com/logo.png" />
              {form.logo && <img src={form.logo} alt="Logo" className="usr-logo-preview" />}
            </div>
          </div>

          <div className="usr-form-actions">
            <button type="button" className="usr-btn usr-btn-ghost" onClick={() => router.push("/admin/users")}>
              Cancel
            </button>
            <button type="submit" className="usr-btn usr-btn-primary" disabled={loading}>
              <UserPlus size={15} /> {loading ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
