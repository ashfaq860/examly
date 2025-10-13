"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import toast from "react-hot-toast";
import { isUserAdmin } from "@/lib/auth-utils";
interface Package {
  id: string;
  name: string;
  type: string;
  price: number;
  duration_days?: number;
  paper_quantity?: number;
  description?: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  cellno: string;
  institution?: string;
  role: string;
}

interface UserPackage {
  id: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  packages: Package;
  profiles: Profile;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<UserPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

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
      await fetchOrders();
      setLoading(false);
    }
    init();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/admin/orders");
      const data = await res.json();
      if (res.ok) setOrders(data);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  };

  const handleAction = async (id: string, action: "approve" | "reject") => {
    const confirmMsg =
      action === "approve"
        ? "Are you sure you want to approve this order?"
        : "Are you sure you want to reject this order?";

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        toast.success(
          action === "approve"
            ? "✅ Order approved successfully"
            : "❌ Order rejected successfully"
        );
        setOrders((prev) => prev.filter((o) => o.id !== id));
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to update order.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong.");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="container text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!authorized) {
    return (
      <AdminLayout>
        <div className="container text-center py-5">
          <div className="alert alert-danger">
            🚫 You are not authorized to view this page.
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container py-4">
        <h1 className="mb-4 fw-bold">Pending Subscription Orders</h1>
        {orders.length === 0 ? (
          <div className="alert alert-info">
            No pending subscription requests.
          </div>
        ) : (
          <div className="table-responsive shadow rounded">
            <table className="table table-striped align-middle">
              <thead className="table-dark">
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Institution</th>
                  <th>Package</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>Requested On</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => (
                  <tr key={order.id}>
                    <td>{index + 1}</td>
                    <td>{order.profiles?.full_name}</td>
                    <td>{order.profiles?.email}</td>
                    <td>{order.profiles?.cellno}</td>
                    <td>{order.profiles?.institution || "—"}</td>
                    <td>{order.packages?.name}</td>
                    <td>{order.packages?.type}</td>
                    <td>PKR {order.packages?.price}</td>
                    <td>{new Date(order.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-success btn-sm me-2"
                        onClick={() => handleAction(order.id, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleAction(order.id, "reject")}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
