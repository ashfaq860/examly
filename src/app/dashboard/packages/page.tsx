'use client';

import { useState, useEffect } from 'react';
import AcademyLayout from '@/components/AcademyLayout';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
const supabase = createClientComponentClient();
interface Package {
  id: string;
  name: string;
  type: 'paper_pack' | 'subscription';
  paper_quantity?: number;
  duration_days?: number;
  price: number;
  description: string;
}

interface UserPackage {
  id: string;
  package_id: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  papers_remaining: number | null;
  packages: Package;
}

export default function SubscriptionPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState<UserPackage[]>([]);
  const [inactiveSubscriptions, setInactiveSubscriptions] = useState<UserPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetchPackages();
    fetchUserSubscriptions();
  }, []);

  // 🔹 Fetch packages
  const fetchPackages = async () => {
    try {
      const res = await fetch("/api/subscriptions");
      if (!res.ok) throw new Error("Failed to fetch packages");
      const data = await res.json();
      setPackages(data);
    } catch (err) {
      console.error(err);
    }
  };

  // 🔹 Fetch user subscriptions
  const fetchUserSubscriptions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/subscriptions/${session.user.id}`);
      if (!res.ok) throw new Error("Failed to fetch user subscriptions");
      const data = await res.json();

      const activeSubs = (data || []).filter(
        (sub: UserPackage) =>
          sub.is_active && (!sub.expires_at || new Date(sub.expires_at) > new Date())
      );
      const inactiveSubs = (data || []).filter(
        (sub: UserPackage) =>
          !sub.is_active || (sub.expires_at && new Date(sub.expires_at) <= new Date())
      );

      setActiveSubscriptions(activeSubs);
      setInactiveSubscriptions(inactiveSubs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Subscribe to a package
  const handleSubscribe = async (packageId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ type: "danger", text: "You must be logged in to subscribe" });
        return;
      }

      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, packageId }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to submit subscription request");

      // add to pending list
      setInactiveSubscriptions((prev) => [...prev, result]);
      setMessage({
        type: "success",
        text: "Subscription request submitted! Pending admin approval.",
      });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "danger", text: err.message || "Failed to submit subscription request." });
    }
  };

  // 🔹 Loading spinner
  if (loading) {
    return (
      <AcademyLayout>
        <div className="container text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </AcademyLayout>
    );
  }

  return (
    <AcademyLayout>
      {/* Hero Section */}
      <section className="bg-primary text-white text-center py-5 mb-5 rounded-3 shadow">
        <div className="container">
          <h1 className="display-4 fw-bold">Choose Your Plan</h1>
          <p className="lead">
            Unlock unlimited paper generation for All Board Classes 5th to 12th with flexible subscription packages
          </p>
          <a href="#plans" className="btn btn-light btn-lg mt-3 px-4 me-2">View Plans</a>
          <a href="#benefits" className="btn btn-outline-light btn-lg mt-3 px-4">Why Subscribe?</a>
        </div>
      </section>

      <div className="container py-2">
        {/* Message Alert */}
        {message && (
          <div className={`alert alert-${message.type} alert-dismissible fade show`} role="alert">
            {message.text}
            <button type="button" className="btn-close" onClick={() => setMessage(null)}></button>
          </div>
        )}

        {/* Active Subscriptions */}
        {activeSubscriptions.length > 0 && (
          <div className="alert alert-success mb-5 shadow-sm">
            <h4 className="alert-heading">🎉 Active Subscriptions</h4>
            {activeSubscriptions.map((sub) => (
              <div key={sub.id} className="mb-3">
                <p className="mb-1"><strong>{sub.packages.name}</strong></p>
                <p className="mb-1">
                  Expires on: {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "N/A"}
                </p>
                {sub.packages.type === "paper_pack" && (
                  <p className="mb-0">Papers remaining: {sub.papers_remaining}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pending Subscriptions */}
        {inactiveSubscriptions.length > 0 && (
          <div className="alert alert-info mb-5 shadow-sm">
            <h4 className="alert-heading">⏳ Pending Subscriptions</h4>
            {inactiveSubscriptions.map((sub) => (
              <div key={sub.id} className="mb-2">
                <p className="mb-1">
                  <strong>{sub.packages?.name || "Unknown Package"}</strong> - Waiting for admin approval
                </p>
                <small>Requested on: {new Date(sub.created_at).toLocaleDateString()}</small>
              </div>
            ))}
            <p className="mb-0 mt-2">
              You will be contacted soon to complete your subscription activation.
            </p>
          </div>
        )}

        {/* Plans */}
        <h2 id="plans" className="text-center mb-4 fw-bold">Our Subscription Plans</h2>
        <div className="row row-cols-1 row-cols-md-3 g-4">
          {packages.map((pkg) => {
            const isActive = activeSubscriptions.some((sub) => sub.package_id === pkg.id);
            const isPending = inactiveSubscriptions.some((sub) => sub.package_id === pkg.id);

            return (
              <div key={pkg.id} className="col">
                <div className="card h-100 shadow border-0 hover-shadow transition">
                  <div className="card-body text-center">
                    <h3 className="card-title fw-bold">{pkg.name}</h3>
                    <h4 className="text-primary fw-bold mb-3">PKR {pkg.price}</h4>
                    <p className="text-muted">{pkg.description}</p>
                    {pkg.type === "paper_pack" && pkg.paper_quantity && (
                      <p><span className="badge bg-info">{pkg.paper_quantity} Papers</span></p>
                    )}
                    {pkg.type === "subscription" && pkg.duration_days && (
                      <p><span className="badge bg-success">{pkg.duration_days} Days Access</span></p>
                    )}
                  </div>
                  <div className="card-footer bg-white border-0">
                    <button
                      className={`btn w-100 ${isActive ? "btn-success" : isPending ? "btn-secondary" : "btn-primary"}`}
                      onClick={() => handleSubscribe(pkg.id)}
                      disabled={isActive || isPending}
                    >
                      {isActive ? "✅ Active" : isPending ? "⏳ Pending Approval" : "Subscribe Now"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Benefits Section */}
        <div id="benefits" className="mt-5 py-5 bg-light rounded-3 shadow-sm">
          <div className="container text-center">
            <h3 className="fw-bold mb-4">Why Subscribe?</h3>
            <div className="row row-cols-1 row-cols-md-4 g-4">
              {["📚 Unlimited Papers", "💧 No Watermarks", "⚡ Priority Support", "🚀 Advanced Features"].map(
                (title, i) => (
                  <div key={i} className="col">
                    <div className="p-3 border rounded h-100 bg-white shadow-sm">
                      <h4>{title}</h4>
                      <p>Benefit description here.</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </AcademyLayout>
  );
}
