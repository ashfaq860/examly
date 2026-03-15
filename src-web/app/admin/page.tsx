'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import AdminLayout from '@/components/AdminLayout';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

interface DashboardStats {
  teacherCount: number;
  studentCount: number;
  academyCount: number;
  paperCount: number;
  questionCount: number;
  papersByMonth: { month: string; count: number }[];
  questionsBySubject: { subject_name: string; count: number }[];
  recentActivities: {
    type: string;
    title?: string;
    subject?: string;
    user?: string;
    student?: string;
    academy?: string;
    count?: number;
    timestamp: string;
    id: string;
  }[];
  growthRates: {
    teacherGrowth: number;
    studentGrowth: number;
    academyGrowth: number;
    paperGrowth: number;
  };
  avgPapersPerUser: number;
  systemStatus: {
    apiStatus: string;
    databaseStatus: string;
    storageStatus: string;
    storagePercentage: number;
    storageUsed: number;
    storageLimit: number;
    apiResponseTime: number;
    dbResponseTime: number;
  };
}

export default function Overview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  // Check if user has admin access
  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return false;
      }

      const { data: roleData, error: rpcError } = await supabase
        .rpc('get_user_role', { user_id: user.id });
      
      if (rpcError) {
        console.error('Error fetching user role:', rpcError);
        return false;
      }

      if (roleData !== "admin") {
        router.push('/unauthorized');
        return false;
      }

      setUserRole(roleData);
      return true;
    } catch (error) {
      console.error('Error checking admin access:', error);
      return false;
    }
  };

  // Fetch dashboard data from API
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch("/api/admin/dashboard", {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setStats(data);
      setUsingMockData(false);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load live data. Showing demo data.');
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeDashboard = async () => {
      const isAdmin = await checkAdminAccess();
      if (isAdmin) {
        await fetchDashboardData();
      }
    };

    initializeDashboard();

    // Listen for authentication state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          router.push('/auth/login');
          return;
        }
        
        if (session) {
          const isAdmin = await checkAdminAccess();
          if (isAdmin) {
            await fetchDashboardData();
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  const papersChartData = {
    labels: stats?.papersByMonth?.map(item => item.month) || [],
    datasets: [{
      label: 'Papers Generated',
      data: stats?.papersByMonth?.map(item => item.count) || [],
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  };

  const questionsChartData = {
    labels: stats?.questionsBySubject?.map(item => item.subject_name) || [],
    datasets: [{
      data: stats?.questionsBySubject?.map(item => item.count) || [],
      backgroundColor: [
        'rgba(255, 99, 132, 0.5)',
        'rgba(54, 162, 235, 0.5)',
        'rgba(255, 206, 86, 0.5)',
        'rgba(75, 192, 192, 0.5)',
        'rgba(153, 102, 255, 0.5)',
        'rgba(255, 159, 64, 0.5)'
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)'
      ],
      borderWidth: 1
    }]
  };

  // Format timestamp for display
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  };

  // Get activity icon based on type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'paper_generated':
        return 'bi-file-earmark-text text-info';
      case 'question_added':
        return 'bi-question-circle text-primary';
      case 'student_registered':
        return 'bi-person-plus text-success';
      default:
        return 'bi-activity text-secondary';
    }
  };

  // Get activity text based on type
  const getActivityText = (activity: any) => {
    switch (activity.type) {
      case 'paper_generated':
        return `${activity.user} generated paper "${activity.title}" for ${activity.academy}`;
      case 'question_added':
        return `${activity.user} added a question to ${activity.subject}`;
      case 'student_registered':
        return `${activity.student} registered at ${activity.academy}`;
      default:
        return 'Unknown activity';
    }
  };

  // Helper function to get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational':
      case 'normal':
      case 'good':
        return 'bg-success';
      case 'degraded':
      case 'slow':
      case 'warning':
        return 'bg-warning';
      case 'down':
      case 'critical':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  };

  // Helper function to format status text
  const formatStatusText = (status: string) => {
    switch (status) {
      case 'operational': return 'Operational';
      case 'normal': return 'Normal';
      case 'good': return 'Good';
      case 'degraded': return 'Degraded';
      case 'slow': return 'Slow';
      case 'warning': return 'Warning';
      case 'down': return 'Down';
      case 'critical': return 'Critical';
      case 'unknown': return 'Unknown';
      default: return status;
    }
  };

  if (loading) {
    return (
      <AdminLayout activeTab="overview">
        <div className="container-fluid py-4">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
            <div className="text-center">
              <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3">Loading dashboard data...</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="overview">
      <div className="container-fluid py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="mb-0">Dashboard Overview</h2>
          <div>
            {userRole && (
              <span className="badge bg-info me-2">Role: {userRole}</span>
            )}
            {usingMockData && (
              <span className="badge bg-warning me-2">Demo Data</span>
            )}
            <button 
              className="btn btn-outline-primary btn-sm"
              onClick={() => fetchDashboardData()}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Refreshing...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-clockwise me-2"></i>
                  Refresh Data
                </>
              )}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="alert alert-warning d-flex align-items-center" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            <div>
              {error}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="row g-4 mb-4">
          <div className="col-xl-3 col-md-6">
            <div className="card border-primary shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="flex-grow-1">
                    <h5 className="card-title text-primary mb-1">Total Teachers</h5>
                    <p className="card-text display-5 fw-bold mb-0">
                      {stats?.teacherCount || 0}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <i className="bi bi-person-badge text-primary" style={{ fontSize: '2rem' }}></i>
                  </div>
                </div>
                <div className="mt-2">
                  <span className={`badge ${stats?.growthRates?.teacherGrowth >= 0 ? 'bg-success' : 'bg-danger'}`}>
                    {stats?.growthRates?.teacherGrowth >= 0 ? '+' : ''}{stats?.growthRates?.teacherGrowth || 0}% from last month
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-xl-3 col-md-6">
            <div className="card border-success shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="flex-grow-1">
                    <h5 className="card-title text-success mb-1">Total Students</h5>
                    <p className="card-text display-5 fw-bold mb-0">
                      {stats?.studentCount || 0}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <i className="bi bi-people-fill text-success" style={{ fontSize: '2rem' }}></i>
                  </div>
                </div>
                <div className="mt-2">
                  <span className={`badge ${stats?.growthRates?.studentGrowth >= 0 ? 'bg-success' : 'bg-danger'}`}>
                    {stats?.growthRates?.studentGrowth >= 0 ? '+' : ''}{stats?.growthRates?.studentGrowth || 0}% from last month
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-xl-3 col-md-6">
            <div className="card border-info shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="flex-grow-1">
                    <h5 className="card-title text-info mb-1">Academies</h5>
                    <p className="card-text display-5 fw-bold mb-0">
                      {stats?.academyCount || 0}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <i className="bi bi-building text-info" style={{ fontSize: '2rem' }}></i>
                  </div>
                </div>
                <div className="mt-2">
                  <span className={`badge ${stats?.growthRates?.academyGrowth >= 0 ? 'bg-success' : 'bg-danger'}`}>
                    {stats?.growthRates?.academyGrowth >= 0 ? '+' : ''}{stats?.growthRates?.academyGrowth || 0}% from last month
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-xl-3 col-md-6">
            <div className="card border-warning shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="flex-grow-1">
                    <h5 className="card-title text-warning mb-1">Papers Generated</h5>
                    <p className="card-text display-5 fw-bold mb-0">
                      {stats?.paperCount || 0}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <i className="bi bi-file-earmark-text text-warning" style={{ fontSize: '2rem' }}></i>
                  </div>
                </div>
                <div className="mt-2">
                  <span className={`badge ${stats?.growthRates?.paperGrowth >= 0 ? 'bg-success' : 'bg-danger'}`}>
                    {stats?.growthRates?.paperGrowth >= 0 ? '+' : ''}{stats?.growthRates?.paperGrowth || 0}% from last month
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Second Row of Stats */}
        <div className="row g-4 mb-4">
          <div className="col-xl-4 col-md-6">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="flex-grow-1">
                    <h5 className="card-title mb-1">Question Bank Size</h5>
                    <p className="card-text display-4 fw-bold mb-0">
                      {stats?.questionCount || 0}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <i className="bi bi-database" style={{ fontSize: '2.5rem', color: '#6f42c1' }}></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-xl-4 col-md-6">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="flex-grow-1">
                    <h5 className="card-title mb-1">Avg Papers per User</h5>
                    <p className="card-text display-4 fw-bold mb-0">
                      {stats?.avgPapersPerUser || 0}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <i className="bi bi-bar-chart" style={{ fontSize: '2.5rem', color: '#20c997' }}></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-xl-4 col-md-12">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h5 className="card-title mb-3">System Status</h5>
                
                {/* API Service Status */}
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-plugin me-2"></i>
                    <span>API Service</span>
                  </div>
                  <div>
                    <span className={`badge ${getStatusBadge(stats?.systemStatus?.apiStatus || 'unknown')} me-2`}>
                      {formatStatusText(stats?.systemStatus?.apiStatus || 'unknown')}
                    </span>
                    {stats?.systemStatus?.apiResponseTime && (
                      <small className="text-muted">{stats.systemStatus.apiResponseTime}ms</small>
                    )}
                  </div>
                </div>
                
                {/* Database Status */}
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-database me-2"></i>
                    <span>Database</span>
                  </div>
                  <div>
                    <span className={`badge ${getStatusBadge(stats?.systemStatus?.databaseStatus || 'unknown')} me-2`}>
                      {formatStatusText(stats?.systemStatus?.databaseStatus || 'unknown')}
                    </span>
                    {stats?.systemStatus?.dbResponseTime && (
                      <small className="text-muted">{stats.systemStatus.dbResponseTime}ms</small>
                    )}
                  </div>
                </div>
                
                {/* Storage Status */}
                <div className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-hdd me-2"></i>
                    <span>Storage</span>
                  </div>
                  <div className="text-end">
                    <span className={`badge ${getStatusBadge(stats?.systemStatus?.storageStatus || 'unknown')} me-2`}>
                      {stats?.systemStatus?.storagePercentage || 0}% Used
                    </span>
                    <div>
                      <small className="text-muted">
                        {stats?.systemStatus?.storageUsed || 0} / {stats?.systemStatus?.storageLimit || 0}
                      </small>
                    </div>
                  </div>
                </div>
                
                {/* Last Updated */}
                <div className="mt-3 pt-2 border-top">
                  <small className="text-muted">
                    Last updated: {new Date().toLocaleTimeString()}
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="row g-4">
          <div className="col-lg-6">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-white">
                <h5 className="card-title mb-0">Monthly Paper Generation</h5>
              </div>
              <div className="card-body">
                <div style={{ height: '300px' }}>
                  <Bar 
                    data={papersChartData} 
                    options={{ 
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            stepSize: 10
                          }
                        }
                      }
                    }} 
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-lg-6">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-white">
                <h5 className="card-title mb-0">Subject-wise Question Distribution</h5>
              </div>
              <div className="card-body">
                <div style={{ height: '300px' }}>
                  <Pie 
                    data={questionsChartData} 
                    options={{ 
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'right',
                        },
                      }
                    }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="row mt-4">
          <div className="col-12">
            <div className="card shadow-sm">
              <div className="card-header bg-white">
                <h5 className="card-title mb-0">Recent Activity</h5>
              </div>
              <div className="card-body p-0">
                {stats?.recentActivities && stats.recentActivities.length > 0 ? (
                  <div className="list-group list-group-flush">
                    {stats.recentActivities.map((activity, index) => (
                      <div key={index} className="list-group-item d-flex justify-content-between align-items-center px-3 py-2">
                        <div className="d-flex align-items-center">
                          <i className={`bi ${getActivityIcon(activity.type)} me-2`} style={{ fontSize: '1.2rem' }}></i>
                          <span>{getActivityText(activity)}</span>
                        </div>
                        <small className="text-muted">{formatTimeAgo(activity.timestamp)}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <i className="bi bi-inbox" style={{ fontSize: '2rem', color: '#6c757d' }}></i>
                    <p className="mt-2 text-muted">No recent activities</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .bg-purple {
          background-color: #6f42c1;
        }
        .card {
          transition: transform 0.2s;
        }
        .card:hover {
          transform: translateY(-5px);
        }
      `}</style>
    </AdminLayout>
  );
}