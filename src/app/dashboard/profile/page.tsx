"use client";

import { useEffect, useState } from "react";
import AcademyLayout from "@/components/AcademyLayout";
import { User, Phone, University, FileText, Calendar, Package as PackageIcon, Clock, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  institution: string | null;
  created_at: string;
  trial_ends_at: string | null;
  subscription_status: string | null;
  updated_at: string;
  papers_generated: number | null;
  cellno: string | null;
  logo: string | null;
};

type Package = {
  id: string;
  name: string;
  type: string;
  paper_quantity: number | null;
  duration_days: number | null;
  price: number;
  description: string | null;
};

type UserPackage = {
  id: string;
  package_id: string;
  papers_remaining: number | null;
  expires_at: string | null;
  is_trial: boolean;
  stripe_subscription_id: string | null;
  created_at: string;
  is_active: boolean;
  packages: Package;
};

export default function ProfilePage() {
  const supabase = createClientComponentClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userPackages, setUserPackages] = useState<UserPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (!session) {
        setLoading(false);
        setError("Please log in to view your profile");
      }
    };
    getSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setLoading(false);
        setError("Please log in to view your profile");
      }
    });
    
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const fetchProfileAndPackages = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!session) throw new Error("Please log in to view your profile");
        
        const response = await fetch('/api/profile');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch profile: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        setProfile(data.profile);
        setUserPackages(data.userPackages || []);
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.message || "An error occurred while fetching data");
      } finally {
        setLoading(false);
      }
    };
    
    if (session) fetchProfileAndPackages();
  }, [session]);

  const getPackageStatus = (userPackage: UserPackage) => {
    const now = new Date();
    const expiresAt = userPackage.expires_at ? new Date(userPackage.expires_at) : null;
    
    // If is_active is false, show "Pending" status
    if (!userPackage.is_active) {
      return { status: 'pending', label: 'Pending', badgeClass: 'bg-secondary' };
    }
    
    // Check if package has expired by date
    const isExpiredByDate = expiresAt && expiresAt < now;
    
    // Check if paper pack has run out of papers
    const isPaperPackEmpty = userPackage.packages.type === 'paper_pack' && 
                            userPackage.papers_remaining !== null && 
                            userPackage.papers_remaining <= 0;
    
    // If either condition is true, package is expired
    if (isExpiredByDate || isPaperPackEmpty) {
      return { status: 'expired', label: 'Expired', badgeClass: 'bg-danger' };
    }
    
    // Otherwise, package is active
    return { status: 'active', label: 'Active', badgeClass: 'bg-success' };
  };

  const calculateDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const expireDate = new Date(expiresAt);
    const today = new Date();
    const diffTime = expireDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <AcademyLayout>
        <div className="d-flex justify-content-center align-items-center" style={{ height: '256px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </AcademyLayout>
    );
  }

  if (error) {
    return (
      <AcademyLayout>
        <div className="alert alert-danger" role="alert">
          <strong>Error: </strong>
          {error}
        </div>
      </AcademyLayout>
    );
  }

  return (
    <AcademyLayout>
      <div className="container px-0 px-md-3 py-2">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }} 
          className="text-center mb-2 fw-bold"
          style={{ 
            fontSize: '2.5rem', 
            background: 'linear-gradient(to right, #0d6efd, #6f42c1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          My Profile
        </motion.h1>

        {profile && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.4 }} 
            className="rounded-3 shadow-lg p-2 p-md-4 mb-5"
            style={{ background: 'linear-gradient(to right, #eef2ff, #eff6ff)' }}
          >
            <div className="d-flex flex-column flex-md-row align-items-center gap-4 mb-4">
              {profile.logo ? (
                <img 
                  src={profile.logo} 
                  alt="Profile" 
                  className="rounded-circle object-fit-cover border border-4 border-primary shadow"
                  style={{ width: '7rem', height: '7rem' }}
                />
              ) : (
                <div 
                  className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow"
                  style={{ 
                    width: '7rem', 
                    height: '7rem', 
                    background: 'linear-gradient(to right, #bee3f8, #a3bffa)',
                    fontSize: '2.5rem'
                  }}
                >
                  {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}

              <div className="flex-grow-1">
                <h2 className="d-flex align-items-center gap-2 fs-3 fw-semibold text-dark mb-1">
                  <User size={20}/> {profile.full_name || "No Name Provided"}
                </h2>
                <p className="text-muted d-flex align-items-center gap-2 mb-2">
                  <Mail size={16} /> {profile.email}
                </p>
                <div className="d-flex gap-2 flex-wrap">
                  <span className="badge bg-primary">{profile.role}</span>
                  <span className={`badge ${profile.subscription_status === 'active' ? 'bg-success' : 'bg-danger'}`}>
                    {profile.subscription_status || 'inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile info in two columns */}
            <div className="row mt-4">
              <div className="col-md-6 mb-3">
                <div className="d-flex align-items-center p-3 bg-white rounded shadow-sm">
                  <div className="me-3 p-2 bg-primary bg-opacity-10 rounded">
                    <University className="text-primary" size={20}/>
                  </div>
                  <div>
                    <div className="text-muted small">Institution</div>
                    <div className="fw-semibold">{profile.institution || "Not specified"}</div>
                  </div>
                </div>
              </div>
              
              <div className="col-md-6 mb-3">
                <div className="d-flex align-items-center p-3 bg-white rounded shadow-sm">
                  <div className="me-3 p-2 bg-info bg-opacity-10 rounded">
                    <FileText className="text-info" size={20}/>
                  </div>
                  <div>
                    <div className="text-muted small">Papers Generated</div>
                    <div className="fw-semibold">{profile.papers_generated || 0}</div>
                  </div>
                </div>
              </div>
              
              <div className="col-md-6 mb-3">
                <div className="d-flex align-items-center p-3 bg-white rounded shadow-sm">
                  <div className="me-3 p-2 bg-success bg-opacity-10 rounded">
                    <Calendar className="text-success" size={20}/>
                  </div>
                  <div>
                    <div className="text-muted small">Member Since</div>
                    <div className="fw-semibold">{new Date(profile.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
              
              <div className="col-md-6 mb-3">
                <div className="d-flex align-items-center p-3 bg-white rounded shadow-sm">
                  <div className="me-3 p-2 bg-warning bg-opacity-10 rounded">
                    <Phone className="text-warning" size={20}/>
                  </div>
                  <div>
                    <div className="text-muted small">Phone Number</div>
                    <div className="fw-semibold">{profile.cellno || "Not provided"}</div>
                  </div>
                </div>
              </div>
            </div>

            {profile.trial_ends_at && (
              <div className="d-flex align-items-center p-3 bg-warning bg-opacity-10 rounded mt-3">
                <div className="me-3 p-2 bg-warning bg-opacity-25 rounded">
                  <Clock className="text-warning" size={20}/>
                </div>
                <div>
                  <div className="text-warning small">Trial Period</div>
                  <div className="fw-semibold">Your trial ends on {new Date(profile.trial_ends_at).toLocaleDateString()}</div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        <h2 className="d-flex align-items-center gap-2 mb-4 fw-bold fs-3 text-dark">
          <PackageIcon size={28}/> My Subscriptions
        </h2>

        {userPackages.length === 0 ? (
          <div className="bg-white rounded shadow p-4 text-center text-muted">
            No subscription packages found.
          </div>
        ) : (
          <div className="row">
            {userPackages.map((userPackage) => {
              const packageStatus = getPackageStatus(userPackage);
              const daysRemaining = calculateDaysRemaining(userPackage.expires_at);
              
              return (
                <motion.div 
                  key={userPackage.id} 
                  whileHover={{ scale: 1.02 }} 
                  className="col-md-6 col-lg-4 mb-4"
                >
                  <div className="card h-100 border-0 shadow-sm">
                    <div className={`card-header ${packageStatus.badgeClass.replace('bg-', 'bg-').replace('bg-', 'bg-')}-10`}>
                      <h5 className="card-title mb-1">{userPackage.packages.name}</h5>
                      <p className="card-text text-muted small mb-0">{userPackage.packages.description}</p>
                    </div>
                    <div className="card-body">
                      <div className="d-flex justify-content-between mb-2">
                        <span>Status:</span>
                        <span className={`badge ${packageStatus.badgeClass}`}>
                          {packageStatus.label}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Type:</span>
                        <span>{userPackage.packages.type}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Price:</span>
                        <span>Rs.{userPackage.packages.price}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Papers Remaining:</span>
                        <span>
                          {userPackage.packages.type === 'paper_pack' 
                            ? (userPackage.papers_remaining ?? 0)
                            : 'Unlimited'
                          }
                        </span>
                      </div>
                      {userPackage.expires_at && (
                        <div className="d-flex justify-content-between mb-2">
                          <span>Expires:</span>
                          <span>{new Date(userPackage.expires_at).toLocaleDateString()}</span>
                        </div>
                      )}
                      {daysRemaining !== null && packageStatus.status === 'active' && (
                        <div className="d-flex justify-content-between mb-2">
                          <span>Days Remaining:</span>
                          <span className={daysRemaining <= 7 ? 'text-danger fw-bold' : 'text-success'}>
                            {daysRemaining}
                          </span>
                        </div>
                      )}
                      {userPackage.is_trial && (
                        <div className="alert alert-warning mt-3 mb-0 py-2">
                          <small>Trial Package</small>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AcademyLayout>
  );
}