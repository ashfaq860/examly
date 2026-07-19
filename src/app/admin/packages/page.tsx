'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { FiEdit, FiTrash2, FiPlus, FiCheck, FiPackage } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface Package {
  id: string;
  name: string;
  type: string;
  price: number;
  currency: string | null;
  duration_days: number | null;
  paper_quantity: number | null;
  description: string | null;
  is_active: boolean;
  features: string[] | null;
  seats: number | null;
  scan_quantity: number | null;
}

const EMPTY_FORM = {
  name: '',
  type: 'paper_pack',
  price: '',
  currency: 'PKR',
  duration_days: '',
  paper_quantity: '',
  description: '',
  is_active: true,
  paperChecker: false,
  seats: '1',
  scan_quantity: '',
};

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/packages');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load packages');
      setPackages(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (pkg: Package) => {
    setEditingId(pkg.id);
    setForm({
      name: pkg.name,
      type: pkg.type === 'subscription' ? 'subscription' : 'paper_pack',
      price: String(pkg.price ?? ''),
      currency: pkg.currency || 'PKR',
      duration_days: pkg.duration_days != null ? String(pkg.duration_days) : '',
      paper_quantity: pkg.paper_quantity != null ? String(pkg.paper_quantity) : '',
      description: pkg.description || '',
      is_active: pkg.is_active,
      paperChecker: Boolean(pkg.features?.includes('paper_checker')),
      seats: String(pkg.seats ?? 1),
      scan_quantity: pkg.scan_quantity != null ? String(pkg.scan_quantity) : '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) {
      toast.error('Name and price are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        price: Number(form.price),
        currency: form.currency.trim() || 'PKR',
        duration_days: form.duration_days ? Number(form.duration_days) : null,
        paper_quantity: form.paper_quantity ? Number(form.paper_quantity) : null,
        description: form.description.trim() || null,
        is_active: form.is_active,
        features: form.paperChecker ? ['paper_generation', 'paper_checker'] : ['paper_generation'],
        seats: Number(form.seats) || 1,
        scan_quantity: form.scan_quantity === '' ? null : Number(form.scan_quantity),
      };

      const res = await fetch(editingId ? `/api/admin/packages/${editingId}` : '/api/admin/packages', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      toast.success(editingId ? 'Package updated' : 'Package created');
      setShowForm(false);
      fetchPackages();
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this package? Existing subscribers keep their entitlements until expiry, but new subscriptions to it will no longer be possible.')) return;
    try {
      const res = await fetch(`/api/admin/packages/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success('Package deleted');
      fetchPackages();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  return (
    <AdminLayout activeTab="packages">
      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-4 bg-white p-3 rounded shadow-sm border-start border-4 border-primary">
          <div>
            <h2 className="fw-bold mb-0">Package Management</h2>
            <p className="text-muted mb-0 small">Plans, feature entitlements, academy seats &amp; scan quotas</p>
          </div>
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={openCreate}>
            <FiPlus /> Add Package
          </button>
        </div>

        {showForm && (
          <div className="card border-0 shadow-lg mb-4">
            <div className="card-header bg-dark text-white">
              {editingId ? 'Edit Package' : 'New Package'}
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Name</label>
                    <input
                      type="text" className="form-control" required
                      value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Academy Pro"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-bold">Type</label>
                    <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                      <option value="paper_pack">Paper pack (fixed quantity)</option>
                      <option value="subscription">Subscription (unlimited papers)</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-bold">Active</label>
                    <div className="form-check form-switch mt-2">
                      <input
                        className="form-check-input" type="checkbox" id="pkgActive"
                        checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}
                      />
                      <label className="form-check-label" htmlFor="pkgActive">Visible / purchasable</label>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-bold">Price</label>
                    <input
                      type="number" className="form-control" required min="0" step="0.01"
                      value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold">Currency</label>
                    <input
                      type="text" className="form-control"
                      value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold">Duration (days)</label>
                    <input
                      type="number" className="form-control" min="0"
                      value={form.duration_days} onChange={e => setForm({ ...form, duration_days: e.target.value })}
                      placeholder="Blank = no expiry"
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-bold">Paper quantity</label>
                    <input
                      type="number" className="form-control" min="0"
                      value={form.paper_quantity} onChange={e => setForm({ ...form, paper_quantity: e.target.value })}
                      placeholder="Blank = unlimited"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold">Academy seats</label>
                    <input
                      type="number" className="form-control" min="1"
                      value={form.seats} onChange={e => setForm({ ...form, seats: e.target.value })}
                    />
                    <span className="form-text">How many teachers (incl. the owner) can share this plan</span>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold">Scan quota</label>
                    <input
                      type="number" className="form-control" min="0"
                      value={form.scan_quantity} onChange={e => setForm({ ...form, scan_quantity: e.target.value })}
                      placeholder="Blank = no scans"
                      disabled={!form.paperChecker}
                    />
                    <span className="form-text">Only used when Paper Checker is enabled below</span>
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-bold">Features</label>
                    <div className="d-flex flex-wrap gap-4">
                      <div className="form-check">
                        <input className="form-check-input" type="checkbox" checked disabled id="featPaperGen" />
                        <label className="form-check-label text-muted" htmlFor="featPaperGen">
                          Paper Generation (always included)
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input" type="checkbox" id="featChecker"
                          checked={form.paperChecker}
                          onChange={e => setForm({ ...form, paperChecker: e.target.checked })}
                        />
                        <label className="form-check-label" htmlFor="featChecker">
                          Paper Checker
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-bold">Description</label>
                    <textarea
                      className="form-control" rows={2}
                      value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    />
                  </div>

                  <div className="col-12 d-flex justify-content-end gap-2 mt-2">
                    <button type="button" className="btn btn-light" onClick={() => setShowForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary px-4" disabled={saving}>
                      {saving ? <span className="spinner-border spinner-border-sm me-2" /> : <FiCheck className="me-1" />}
                      Save Package
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-grow text-primary" role="status" />
                <p className="mt-2 text-muted">Loading packages...</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="bg-light text-muted small text-uppercase">
                    <tr>
                      <th className="ps-4">Package</th>
                      <th>Price</th>
                      <th>Features</th>
                      <th>Seats</th>
                      <th>Scan quota</th>
                      <th>Status</th>
                      <th className="text-end pe-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.length > 0 ? (
                      packages.map(pkg => (
                        <tr key={pkg.id}>
                          <td className="ps-4">
                            <div className="d-flex align-items-center">
                              <div className="bg-soft-primary text-primary rounded p-2 me-3">
                                <FiPackage />
                              </div>
                              <div>
                                <div className="fw-bold">{pkg.name}</div>
                                <div className="text-muted extra-small">{pkg.type.replace(/_/g, ' ')}</div>
                              </div>
                            </div>
                          </td>
                          <td>{pkg.currency || 'PKR'} {pkg.price}</td>
                          <td>
                            {(pkg.features || ['paper_generation']).map(f => (
                              <span key={f} className="badge bg-secondary me-1">{f.replace(/_/g, ' ')}</span>
                            ))}
                          </td>
                          <td>{pkg.seats ?? 1}</td>
                          <td>{pkg.scan_quantity ?? '—'}</td>
                          <td>
                            <span className={`badge ${pkg.is_active ? 'bg-success' : 'bg-secondary'}`}>
                              {pkg.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="text-end pe-4">
                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => openEdit(pkg)}>
                              <FiEdit />
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(pkg.id)}>
                              <FiTrash2 />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-5">
                          <div className="text-muted">No packages yet.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .extra-small { font-size: 0.75rem; }
        .bg-soft-primary { background-color: rgba(13, 110, 253, 0.1); }
      `}</style>
    </AdminLayout>
  );
}
