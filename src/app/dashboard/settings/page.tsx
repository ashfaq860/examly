// examly/src/app/dashboard/settings/page.tsx
"use client";
import { useEffect, useState } from "react";
import AcademyLayout from "@/components/AcademyLayout";
import { User, Phone, University, Mail, Save, Upload, X, Calendar, CheckCircle, AlertCircle, Package, FileText, Clock, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { useUser } from "@/app/context/userContext"; // Import the user context

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
  trial_given: boolean;
};

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cellnoStatus, setCellnoStatus] = useState<'valid' | 'invalid' | 'checking' | null>(null);

  // Use the user context for package/trial status
  const { trialStatus, isLoading: trialLoading } = useUser();

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    institution: '',
    cellno: '',
    email: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/profile/update", {
          method: "GET",
          credentials: "include",
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || "Failed to fetch profile");
        }
        
        const data = await res.json();
        setProfile(data);
      } catch (err: any) {
        console.error("Error fetching profile:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        institution: profile.institution || '',
        cellno: profile.cellno || '',
        email: profile.email || ''
      });
    }
  }, [profile]);

  // Validate phone number format and check availability
  const validatePhoneNumber = (phone: string): boolean => {
    // Remove any non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    // Check if it's exactly 11 digits and starts with 03
    return /^03\d{9}$/.test(cleanPhone);
  };

  // Check cellno availability
  useEffect(() => {
    const checkCellnoAvailability = async () => {
      if (!formData.cellno || formData.cellno === profile?.cellno) {
        setCellnoStatus(null);
        return;
      }

      // Validate phone number format
      if (!validatePhoneNumber(formData.cellno)) {
        setCellnoStatus('invalid');
        return;
      }

      setCellnoStatus('checking');

      try {
        const response = await fetch('/api/profile/check-cellno', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ cellno: formData.cellno }),
        });

        if (response.ok) {
          setCellnoStatus('valid');
        } else {
          const errorData = await response.json();
          setCellnoStatus('invalid');
        }
      } catch (error) {
        setCellnoStatus('invalid');
      }
    };

    const timeoutId = setTimeout(checkCellnoAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.cellno, profile?.cellno]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Format phone number as user types
    if (name === 'cellno') {
      // Remove non-digit characters
      let formattedValue = value.replace(/\D/g, '');
      
      // Limit to 11 digits
      if (formattedValue.length > 11) {
        formattedValue = formattedValue.slice(0, 11);
      }
      
      // Format as 0300-3245632
      if (formattedValue.length > 4) {
        formattedValue = `${formattedValue.slice(0, 4)}-${formattedValue.slice(4)}`;
      }
      
      setFormData(prev => ({
        ...prev,
        [name]: formattedValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    // Validate phone number format
    if (formData.cellno && !validatePhoneNumber(formData.cellno)) {
      setError("Please enter a valid 11-digit phone number starting with 03 (e.g., 0300-3245632)");
      setSaving(false);
      return;
    }
    
    // Check if cellno is changed and validate availability
    if (formData.cellno && formData.cellno !== profile?.cellno && cellnoStatus !== 'valid') {
      setError("Please wait while we check phone number availability");
      setSaving(false);
      return;
    }
    
    try {
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', 
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to update profile";
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      const updatedData = await response.json();
      setSuccess("Profile updated successfully!");
      
      // Update local profile state with the returned data
      setProfile(prev => prev ? {
        ...prev,
        full_name: updatedData.full_name,
        institution: updatedData.institution,
        cellno: updatedData.cellno,
        updated_at: updatedData.updated_at,
        trial_given: updatedData.trial_given,
        trial_ends_at: updatedData.trial_ends_at
      } : null);
      
    } catch (err: any) {
      setError(err.message || "An error occurred while updating profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }
      
      const file = e.target.files[0];
      
      // Validate file size (Max 500KB)
      const fileSizeInKB = file.size / 1024;
      if (fileSizeInKB > 500) {
        throw new Error('Image size must be less than 500KB.');
      }
      
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Only JPG, PNG, and GIF images are allowed.');
      }
      
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/profile/logo', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to upload logo";
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Update local state
      setProfile(prev => prev ? { ...prev, logo: data.logo } : null);
      setSuccess("Profile picture updated successfully!");
      
    } catch (err: any) {
      setError(err.message || "Error uploading image");
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    try {
      const response = await fetch('/api/profile/logo', {
        method: 'DELETE',
        credentials: 'include', 
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to remove logo";
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      setProfile(prev => prev ? { ...prev, logo: null } : null);
      setSuccess("Profile picture removed successfully!");
      
    } catch (err: any) {
      setError(err.message || "Error removing profile picture");
    }
  };

  // Helper function to get package status alert
  const renderPackageStatus = () => {
    if (trialLoading || !trialStatus) {
      return null;
    }

    const { 
      isTrial, 
      trialEndsAt, 
      hasActiveSubscription, 
      papersRemaining, 
      subscriptionName,
      subscriptionType,
      subscriptionEndDate,
      message
    } = trialStatus;

    // Determine alert type and content
    let alertType = "info";
    let icon = <Package size={18} />;
    let title = "Package Status";
    let content = null;

    if (message) {
      // If there's a message from the API, use it
      content = <div>{message}</div>;
    } else if (isTrial && trialEndsAt) {
      alertType = "success";
      icon = <Crown size={18} />;
      title = "Free Trial Active";
      content = (
        <>
          <div>Your trial ends on {new Date(trialEndsAt).toLocaleDateString()}</div>
          <small className="text-muted">You have unlimited paper generation during your trial period</small>
        </>
      );
    } else if (hasActiveSubscription) {
      alertType = "warning";
      icon = <Crown size={18} />;
      title = subscriptionName || "Active Subscription";
      
      content = (
        <>
          <div>
            {subscriptionType === 'paper_pack' ? (
              <>
                <FileText size={16} className="me-1" />
                Paper Pack: {papersRemaining === 'unlimited' ? 'Unlimited' : `${papersRemaining} papers remaining`}
              </>
            ) : (
              <>
                <Clock size={16} className="me-1" />
                Subscription ends on {subscriptionEndDate ? new Date(subscriptionEndDate).toLocaleDateString() : 'N/A'}
              </>
            )}
          </div>
          {papersRemaining !== 'unlimited' && subscriptionType === 'paper_pack' && (
            <small className="text-muted">
              Papers generated: {trialStatus.papersGenerated || 0}
            </small>
          )}
        </>
      );
    } else {
      alertType = "secondary";
      icon = <FileText size={18} />;
      title = "Free Plan";
      content = (
        <>
          <div>You are currently on the free plan</div>
          <small className="text-muted">
            {papersRemaining === 0 ? 
              "You have no papers remaining. Upgrade to generate more papers." : 
              `You have ${papersRemaining} papers remaining`}
          </small>
        </>
      );
    }

    return (
      <div className={`alert alert-${alertType} mb-4`}>
        <div className="d-flex align-items-center">
          <div className="me-2">
            {icon}
          </div>
          <div>
            <strong>{title}</strong>
            {content}
          </div>
        </div>
      </div>
    );
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

  if (error && !profile) {
    return (
      <AcademyLayout>
        <div className="container px-1 px-md-3 py-3">
          <div className="alert alert-danger d-flex align-items-center" role="alert">
            <div>
              <strong>Error: </strong>
              {error}
            </div>
            <button 
              type="button" 
              className="btn-close ms-auto" 
              onClick={() => setError(null)}
            ></button>
          </div>
          <div className="text-center mt-4">
            <button 
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </AcademyLayout>
    );
  }

  return (
    <AcademyLayout>
      <div className="container px-2 px-md-3 py-0 py-md-3">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }} 
          className="text-center mb-2 mb-md-3 fw-bold"
          style={{ 
            fontSize: '2.5rem', 
            background: 'linear-gradient(to right, #0d6efd, #6f42c1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Profile Settings
        </motion.h1>

        {error && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            <strong>Error: </strong>
            {error}
            <button type="button" className="btn-close" onClick={() => setError(null)}></button>
          </div>
        )}

        {success && (
          <div className="alert alert-success alert-dismissible fade show" role="alert">
            <strong>Success: </strong>
            {success}
            <button type="button" className="btn-close" onClick={() => setSuccess(null)}></button>
          </div>
        )}

        {profile && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.4 }} 
            className="row justify-content-center"
          >
            <div className="col-lg-8">
              <div className="card shadow-sm border-0">
                <div className="card-header bg-primary text-white py-3">
                  <h5 className="card-title mb-0">Edit Your Profile</h5>
                </div>
                <div className="card-body p-1 p-md-4">
                  <form onSubmit={handleSubmit}>
                    {/* Profile Picture Upload */}
                    <div className="row mb-4">
                      <div className="col-md-12">
                        <label className="form-label fw-semibold">Academy Logo <small>(For Question paper or Test)</small></label>
                        <div className="d-flex align-items-center">
                          <div className="position-relative me-4">
                            {profile.logo ? (
                              <img 
                                src={profile.logo} 
                                alt="Profile" 
                                className="rounded-circle object-fit-cover border border-3 border-primary"
                                style={{ width: '100px', height: '100px' }}
                              />
                            ) : (
                              <div 
                                className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold border border-3 border-primary"
                                style={{ 
                                  width: '100px', 
                                  height: '100px', 
                                  background: 'linear-gradient(to right, #bee3f8, #a3bffa)',
                                  fontSize: '2.5rem'
                                }}
                              >
                                {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                              </div>
                            )}
                            {profile.logo && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm position-absolute top-0 end-0 rounded-circle"
                                style={{ width: '28px', height: '28px' }}
                                onClick={removeLogo}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                          <div>
                            <input
                              type="file"
                              id="logo-upload"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              style={{ display: 'none' }}
                            />
                            <label htmlFor="logo-upload" className="btn btn-outline-primary mb-2">
                              {uploading ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload size={16} className="me-2" />
                                  Upload Academy Logo
                                </>
                              )}
                            </label>
                            <div className="form-text">JPG, PNG or GIF. Max size 500KB.</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Name and Email */}
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label htmlFor="full_name" className="form-label">
                          <User size={16} className="me-2" />
                          Full Name
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="full_name"
                          name="full_name"
                          value={formData.full_name}
                          onChange={handleInputChange}
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div className="col-md-6">
                        <label htmlFor="email" className="form-label">
                          <Mail size={16} className="me-2" />
                          Email Address
                        </label>
                        <input
                          type="email"
                          className="form-control"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          disabled
                          placeholder="Email address"
                        />
                        <div className="form-text">Email cannot be changed</div>
                      </div>
                    </div>

                    {/* Institution and Phone */}
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label htmlFor="institution" className="form-label">
                          <University size={16} className="me-2" />
                          Institution
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="institution"
                          name="institution"
                          value={formData.institution}
                          onChange={handleInputChange}
                          placeholder="Enter your institution"
                        />
                      </div>
                      <div className="col-md-6">
                        <label htmlFor="cellno" className="form-label">
                          <Phone size={16} className="me-2" />
                          Phone Number
                        </label>
                        <div className="position-relative">
                          <input
                            type="tel"
                            className={`form-control ${cellnoStatus === 'invalid' ? 'is-invalid' : ''} ${cellnoStatus === 'valid' ? 'is-valid' : ''}`}
                            id="cellno"
                            name="cellno"
                            value={formData.cellno}
                            onChange={handleInputChange}
                            placeholder=" 0300-1234567"
                            maxLength={12}
                          />
                          {cellnoStatus === 'checking' && (
                            <div className="position-absolute end-0 top-0 mt-2 me-2">
                              <div className="spinner-border spinner-border-sm text-primary" role="status">
                                <span className="visually-hidden">Checking...</span>
                              </div>
                            </div>
                          )}
                          {cellnoStatus === 'valid' && (
                            <div className="position-absolute end-0 top-0 mt-2 me-2">
                              <CheckCircle size={16} className="text-success" />
                            </div>
                          )}
                          {cellnoStatus === 'invalid' && (
                            <div className="position-absolute end-0 top-0 mt-2 me-2">
                              <AlertCircle size={16} className="text-danger" />
                            </div>
                          )}
                        </div>
                        <div className="form-text">
                          {cellnoStatus === 'invalid' ? "Phone number is invalid or already registered" : 
                           cellnoStatus === 'valid' ? "Phone number is available" :
                           "11-digit number starting with 03 (e.g., 03001234567)"}
                        </div>
                      </div>
                    </div>

                    {/* Package Status Information */}
                    {renderPackageStatus()}

                    <div className="mt-4">
                      <button 
                        type="submit" 
                        className="btn btn-primary px-4 py-2"
                        disabled={saving || (formData.cellno && formData.cellno !== profile.cellno && cellnoStatus !== 'valid')}
                      >
                        {saving ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={18} className="me-2" />
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Account Information Card */}
              <div className="card shadow-sm border-0 mt-4">
                <div className="card-header bg-light py-3">
                  <h5 className="card-title mb-0">Account Information</h5>
                </div>
                <div className="card-body p-4">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <div className="d-flex align-items-center p-3 bg-light rounded">
                        <div className="me-3 p-2 bg-primary bg-opacity-10 rounded">
                          <User className="text-primary" size={20}/>
                        </div>
                        <div>
                          <div className="text-muted small">Account Role</div>
                          <div className="fw-semibold">{profile.role}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-md-6 mb-3">
                      <div className="d-flex align-items-center p-3 bg-light rounded">
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
                      <div className="d-flex align-items-center p-3 bg-light rounded">
                        <div className="me-3 p-2 bg-info bg-opacity-10 rounded">
                          <Save className="text-info" size={20}/>
                        </div>
                        <div>
                          <div className="text-muted small">Last Updated</div>
                          <div className="fw-semibold">{new Date(profile.updated_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-md-6 mb-3">
                      <div className="d-flex align-items-center p-3 bg-light rounded">
                        <div className="me-3 p-2 bg-warning bg-opacity-10 rounded">
                          <Mail className="text-warning" size={20}/>
                        </div>
                        <div>
                          <div className="text-muted small">Subscription Status</div>
                          <div className="fw-semibold">{profile.subscription_status || 'inactive'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </AcademyLayout>
  );
}