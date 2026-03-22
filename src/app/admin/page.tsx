'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import AdminLayout from '@/components/AdminLayout';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart, registerables, ScriptableContext } from 'chart.js';
import { 
  Users, BookOpen, Home, FileText, 
  Activity, Database, Server, RefreshCw,
  AlertCircle, CheckCircle2, ChevronRight
} from 'lucide-react';

Chart.register(...registerables);

// --- Interfaces ---
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
    storagePercentage: number;
    apiResponseTime: number;
    dbResponseTime: number;
  };
}

export default function Overview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return false; }
      const { data: role } = await supabase.rpc('get_user_role', { user_id: user.id });
      if (role !== "admin") { router.push('/unauthorized'); return false; }
      setUserRole(role);
      return true;
    } catch { return false; }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/dashboard", { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch {
      setError('Live connection failed. Displaying cached/demo data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAdminAccess().then(admin => admin && fetchData());
  }, []);

  // --- Chart Configurations ---
  const barData = {
    labels: stats?.papersByMonth?.map(m => m.month) || [],
    datasets: [{
      label: 'Papers',
      data: stats?.papersByMonth?.map(m => m.count) || [],
      backgroundColor: (context: ScriptableContext<'bar'>) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
        return gradient;
      },
      borderRadius: 6,
    }]
  };

  const doughnutData = {
    labels: stats?.questionsBySubject?.map(s => s.subject_name) || [],
    datasets: [{
      data: stats?.questionsBySubject?.map(s => s.count) || [],
      backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'],
      borderWidth: 0,
      hoverOffset: 20
    }]
  };

  if (loading) return (
    <AdminLayout activeTab="overview">
      <div className="d-flex flex-column justify-content-center align-items-center vh-100 bg-light">
        <div className="custom-loader mb-3"></div>
        <p className="text-muted fw-medium animate-pulse">Synchronizing Examly Dashboard...</p>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout activeTab="overview">
      <div className="container-fluid px-4 py-5">
        
        {/* Header */}
        <div className="d-flex justify-content-between align-items-end mb-5">
          <div>
            <h2 className="fw-bold text-dark mb-1">Platform Insights</h2>
            <p className="text-muted small mb-0">Overview of Examly's academic ecosystem.</p>
          </div>
          <button className="btn-glass d-flex align-items-center gap-2" onClick={fetchData}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh Data
          </button>
        </div>

        {error && (
          <div className="glass-alert mb-4">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* Top Metric Grid */}
        <div className="row g-4 mb-5">
          <MetricCard title="Teachers" value={stats?.teacherCount} growth={stats?.growthRates?.teacherGrowth} icon={<Users size={22} />} color="blue" />
          <MetricCard title="Students" value={stats?.studentCount} growth={stats?.growthRates?.studentGrowth} icon={<BookOpen size={22} />} color="green" />
          <MetricCard title="Academies" value={stats?.academyCount} growth={stats?.growthRates?.academyGrowth} icon={<Home size={22} />} color="purple" />
          <MetricCard title="Papers" value={stats?.paperCount} growth={stats?.growthRates?.paperGrowth} icon={<FileText size={22} />} color="orange" />
        </div>

        <div className="row g-4">
          {/* Main Analytics */}
          <div className="col-lg-8">
            <div className="glass-card p-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h6 className="fw-bold m-0">Generation Trends</h6>
                <div className="status-indicator">Monthly Data</div>
              </div>
              <div style={{ height: '320px' }}>
                <Bar data={barData} options={chartOptions} />
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="col-lg-4">
            <div className="glass-card p-4 h-100">
              <h6 className="fw-bold mb-4">System Infrastructure</h6>
              <HealthRow label="Core API" status={stats?.systemStatus?.apiStatus} ms={stats?.systemStatus?.apiResponseTime} />
              <HealthRow label="Database" status={stats?.systemStatus?.databaseStatus} ms={stats?.systemStatus?.dbResponseTime} />
              
              <div className="mt-5">
                <div className="d-flex justify-content-between mb-2">
                  <span className="small text-muted">Cloud Storage</span>
                  <span className="small fw-bold">{stats?.systemStatus?.storagePercentage}%</span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-fill" style={{ width: `${stats?.systemStatus?.storagePercentage}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Activity & Subjects */}
          <div className="col-lg-6">
            <div className="glass-card p-4">
              <h6 className="fw-bold mb-4">Subject Distribution</h6>
              <div style={{ height: '300px' }}>
                <Doughnut data={doughnutData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="glass-card p-4">
              <h6 className="fw-bold mb-4">Live Activity Feed</h6>
              <div className="activity-list">
                {stats?.recentActivities.map((act, i) => (
                  <div key={i} className="activity-item">
                    <div className="activity-icon-sm"><Activity size={14} /></div>
                    <div className="flex-grow-1 ms-3">
                      <p className="small mb-0 text-dark fw-medium">
                        {act.user || act.student} <span className="text-muted fw-normal">performed</span> {act.type.replace('_', ' ')}
                      </p>
                      <span className="tiny text-muted">{(act.timestamp)}</span>
                    </div>
                    <ChevronRight size={14} className="text-muted" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: 20px;
          box-shadow: 0 10px 30px -5px rgba(0,0,0,0.04);
        }
        .btn-glass {
          background: #fff;
          border: 1px solid #e2e8f0;
          padding: 8px 18px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.85rem;
          color: #475569;
          transition: all 0.2s;
        }
        .btn-glass:hover {
          background: #f8fafc;
          border-color: #3b82f6;
          color: #3b82f6;
        }
        .metric-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bg-blue-soft { background: #eff6ff; color: #3b82f6; }
        .bg-green-soft { background: #f0fdf4; color: #10b981; }
        .bg-purple-soft { background: #faf5ff; color: #8b5cf6; }
        .bg-orange-soft { background: #fff7ed; color: #f59e0b; }

        .progress-bar-container { height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #60a5fa); border-radius: 10px; }

        .activity-item {
          display: flex;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .activity-icon-sm {
          background: #f8fafc;
          padding: 8px;
          border-radius: 10px;
          color: #64748b;
        }
        .tiny { font-size: 0.7rem; }
        .spin { animation: spin 2s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
      `}</style>
    </AdminLayout>
  );
}

// --- Sub Components ---

function MetricCard({ title, value, growth, icon, color }: any) {
  return (
    <div className="col-xl-3 col-md-6">
      <div className="glass-card p-4">
        <div className="d-flex justify-content-between mb-3">
          <div className={`metric-icon bg-${color}-soft`}>{icon}</div>
          <span className={`badge rounded-pill ${growth >= 0 ? 'bg-success' : 'bg-danger'} bg-opacity-10 text-${growth >= 0 ? 'success' : 'danger'} border-0 px-3 py-2 small`}>
            {growth >= 0 ? '+' : ''}{growth}%
          </span>
        </div>
        <p className="text-muted small fw-bold text-uppercase tracking-wider mb-1">{title}</p>
        <h2 className="fw-bold m-0">{value?.toLocaleString() || 0}</h2>
      </div>
    </div>
  );
}

function HealthRow({ label, status, ms }: any) {
  const isOk = status === 'operational' || status === 'normal';
  return (
    <div className="d-flex justify-content-between align-items-center mb-3 p-2 rounded-3 hover-bg">
      <div className="d-flex align-items-center gap-3">
        <div className={`health-dot ${isOk ? 'bg-success' : 'bg-warning'}`}></div>
        <span className="small fw-semibold">{label}</span>
      </div>
      <div className="text-end">
        <span className="small d-block fw-bold">{isOk ? 'Operational' : 'Slow'}</span>
        <span className="tiny text-muted">{ms}ms</span>
      </div>
    </div>
  );
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, border: { display: false } },
    y: { border: { display: false }, ticks: { stepSize: 20 } }
  }
};