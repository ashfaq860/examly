'use client';
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "bootstrap/dist/css/bootstrap.min.css";

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPackages = async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("is_active", true)
       .order("price", { ascending: true });

      if (error) {
        console.error("Error fetching packages:", error);
      } else {
        setPackages(data || []);
      }
      setLoading(false);
    };

    fetchPackages();
  }, []);

  return (
    <>
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="container py-5 mt-4">
        <h1 className="text-center mb-5 fw-bold display-6 text-uppercase mt-4">
          Our Packages
        </h1>

        {loading ? (
          <div className="text-center py-5 fs-5 text-secondary">
            Loading packages...
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-5 text-muted fs-5">
            No active packages available.
          </div>
        ) : (
          <div className="row g-4">
            {packages.map((pkg) => (
              <div className="col-12 col-md-6 col-lg-4" key={pkg.id}>
                <div
                  className="card h-100 shadow-lg border-0 rounded-4 overflow-hidden package-card"
                  style={{
                    transition: "transform 0.3s, box-shadow 0.3s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-6px)";
                    e.currentTarget.style.boxShadow =
                      "0 1rem 2rem rgba(0,0,0,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow =
                      "0 .5rem 1rem rgba(0,0,0,0.1)";
                  }}
                >
                  <div
                    className="card-header text-white text-center py-3 fw-bold"
                    style={{
                      background: "linear-gradient(135deg, #1BA699, #107060)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {pkg.name}
                  </div>

                  <div className="card-body d-flex flex-column bg-light">
                    <h6 className="text-muted text-capitalize mb-3">
                      <i className="bi bi-box-seam me-1"></i>
                      {pkg.type.replace("_", " ")}
                    </h6>

                    <p className="card-text flex-grow-1 text-secondary">
                      {pkg.description || "No description provided."}
                    </p>

                    <ul className="list-unstyled mb-4">
                      {pkg.paper_quantity && (
                        <li className="mb-2">
                          <i className="bi bi-file-earmark-text-fill text-success me-2"></i>
                          <strong>Papers:</strong> {pkg.paper_quantity}
                        </li>
                      )}
                      {pkg.duration_days && (
                        <li className="mb-2">
                          <i className="bi bi-clock-history text-info me-2"></i>
                          <strong>Duration:</strong> {pkg.duration_days} days
                        </li>
                      )}
                      <li className="mb-2">
                        <i className="bi bi-cash-stack text-warning me-2"></i>
                        <strong>Price:</strong> Rs {pkg.price}
                      </li>
                    </ul>

                    <button
                      className="btn btn-success w-100 mt-auto fw-semibold py-2"
                      style={{
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #1BA699, #159380)",
                        border: "none",
                        transition: "all 0.3s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "0.9")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = "1")
                      }
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </>
  );
}
