//admin/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart, registerables, ScriptableContext } from 'chart.js';
import {
  Users, BookOpen, Home, FileText,
  Activity, RefreshCw,
  AlertCircle, ChevronRight, TrendingUp, TrendingDown
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

const METRIC_DEFS = [
  { key: 'teacherCount', growthKey: 'teacherGrowth', title: 'Teachers', icon: Users, accent: 'blue' },
  { key: 'studentCount', growthKey: 'studentGrowth', title: 'Students', icon: BookOpen, accent: 'green' },
  { key: 'academyCount', growthKey: 'academyGrowth', title: 'Academies', icon: Home, accent: 'violet' },
  { key: 'paperCount', growthKey: 'paperGrowth', title: 'Papers Generated', icon: FileText, accent: 'amber' },
] as const;

export default function Overview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return false; }
      const { data: role } = await supabase.rpc('get_user_role', { user_id: user.id });
      const role_ = (role as any)?.role || role;
      if (role_ !== 'admin' && role_ !== 'super_admin') { router.push('/unauthorized'); return false; }
      setUserRole(role_);
      return true;
    } catch { return false; }
  };

  const fetchData = async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await fetch('/api/admin/dashboard', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch {
      setError('Live connection failed — showing the most recent cached snapshot.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    checkAdminAccess().then(admin => admin && fetchData());
  }, []);

  // --- Chart configs ---
  const barData = {
    labels: stats?.papersByMonth?.map(m => m.month) || [],
    datasets: [{
      label: 'Papers',
      data: stats?.papersByMonth?.map(m => m.count) || [],
      backgroundColor: (context: ScriptableContext<'bar'>) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 280);
        gradient.addColorStop(0, '#2f4fe0');
        gradient.addColorStop(1, 'rgba(47, 79, 224, 0.08)');
        return gradient;
      },
      borderRadius: 5,
      maxBarThickness: 36,
    }],
  };

  const doughnutPalette = ['#2f4fe0', '#1d8a52', '#c8473a', '#a3650a', '#6c4fd6', '#101935'];
  const doughnutData = {
    labels: stats?.questionsBySubject?.map(s => s.subject_name) || [],
    datasets: [{
      data: stats?.questionsBySubject?.map(s => s.count) || [],
      backgroundColor: doughnutPalette,
      borderWidth: 0,
      hoverOffset: 10,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { family: 'Lexend', size: 11 }, color: '#686f8c' } },
      y: { grid: { color: '#eef0f6' }, border: { display: false }, ticks: { stepSize: 20, font: { family: 'Lexend', size: 11 }, color: '#686f8c' } },
    },
  };

  if (loading) {
    return (
      <AdminLayout activeTab="overview">
        <div className="ov-loadwrap">
          <div className="ov-spin" />
          <p>Synchronizing Examly dashboard…</p>
        </div>
        <style jsx global>{`
          .ov-loadwrap { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:70vh; gap:14px; font-family:'Lexend','Inter',sans-serif; color:#686f8c; font-size:.86rem; font-weight:550; }
          .ov-spin { width:38px; height:38px; border:3px solid #e6e8f1; border-top-color:#2f4fe0; border-radius:50%; animation:ovspin .7s linear infinite; }
          @keyframes ovspin { to { transform:rotate(360deg); } }
        `}</style>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="overview">
      <div className="ov">

        {/* ── Header ── */}
        <div className="ov-hd">
          <div>
            <div className="ov-eyebrow"><span className="ov-eyebrow-dot" />Platform overview</div>
            <h1>Examly Insights</h1>
            <p>A live read on teachers, academies, and the papers they're generating.</p>
          </div>
          <button className="ov-refresh-btn" onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'ov-spin-icon' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </button>
        </div>

        {error && (
          <div className="ov-alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* ── Metric grid ── */}
        <div className="ov-metric-grid">
          {METRIC_DEFS.map(def => (
            <MetricCard
              key={def.key}
              title={def.title}
              value={stats?.[def.key] as number | undefined}
              growth={stats?.growthRates?.[def.growthKey]}
              icon={<def.icon size={19} />}
              accent={def.accent}
              series={stats?.papersByMonth?.map(m => m.count)}
            />
          ))}
        </div>

        {/* ── Main grid ── */}
        <div className="ov-grid">

          {/* Trends */}
          <div className="ov-card ov-card-trends">
            <div className="ov-card-hd">
              <h3>Generation trends</h3>
              <span className="ov-pill">Monthly</span>
            </div>
            <div className="ov-chart-box ov-chart-box--bar">
              <Bar data={barData} options={chartOptions} />
            </div>
          </div>

          {/* System health */}
          <div className="ov-card ov-card-health">
            <div className="ov-card-hd"><h3>System infrastructure</h3></div>

            <HealthRow label="Core API" status={stats?.systemStatus?.apiStatus} ms={stats?.systemStatus?.apiResponseTime} />
            <HealthRow label="Database" status={stats?.systemStatus?.databaseStatus} ms={stats?.systemStatus?.dbResponseTime} />

            <div className="ov-storage">
              <div className="ov-storage-row">
                <span>Cloud storage</span>
                <span className="ov-storage-pct">{stats?.systemStatus?.storagePercentage ?? 0}%</span>
              </div>
              <div className="ov-progress-track">
                <div className="ov-progress-fill" style={{ width: `${stats?.systemStatus?.storagePercentage ?? 0}%` }} />
              </div>
            </div>
          </div>

          {/* Subject distribution */}
          <div className="ov-card ov-card-subjects">
            <div className="ov-card-hd"><h3>Question bank by subject</h3></div>
            <div className="ov-chart-box ov-chart-box--donut">
              {stats?.questionsBySubject?.length ? (
                <Doughnut data={doughnutData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '68%' }} />
              ) : (
                <div className="ov-empty-mini">No subject data yet</div>
              )}
            </div>
            {!!stats?.questionsBySubject?.length && (
              <div className="ov-legend">
                {stats.questionsBySubject.slice(0, 6).map((s, i) => (
                  <div className="ov-legend-row" key={s.subject_name}>
                    <span className="ov-legend-dot" style={{ background: doughnutPalette[i % doughnutPalette.length] }} />
                    <span className="ov-legend-label">{s.subject_name}</span>
                    <span className="ov-legend-count">{s.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="ov-card ov-card-activity">
            <div className="ov-card-hd"><h3>Live activity</h3></div>
            <div className="ov-activity-list">
              {stats?.recentActivities?.length ? stats.recentActivities.map((act, i) => (
                <div key={act.id ?? i} className="ov-activity-item">
                  <div className="ov-activity-icon"><Activity size={13} /></div>
                  <div className="ov-activity-body">
                    <p>
                      <strong>{act.user || act.student || 'Someone'}</strong>{' '}
                      <span>performed {act.type.replace(/_/g, ' ')}</span>
                    </p>
                    <span className="ov-activity-time">{act.timestamp}</span>
                  </div>
                  <ChevronRight size={14} className="ov-activity-chevron" />
                </div>
              )) : (
                <div className="ov-empty-mini">No recent activity</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .ov {
          --ov-navy: #101935;
          --ov-accent: #2f4fe0;
          --ov-accent-soft: #eef1ff;
          --ov-bg: #f5f6fb;
          --ov-surface: #ffffff;
          --ov-border: #e6e8f1;
          --ov-text: #15192b;
          --ov-muted: #686f8c;
          --ov-green: #1d8a52;
          --ov-green-soft: #e9f9ef;
          --ov-amber: #a3650a;
          --ov-amber-soft: #fff3bf;
          --ov-violet: #6c4fd6;
          --ov-violet-soft: #f1eefd;
          --ov-red: #c8473a;
          --ov-red-soft: #fdeeec;
          --ov-radius: 16px;
          --ov-font: 'Lexend','Inter',system-ui,sans-serif;
          --ov-mono: 'JetBrains Mono',ui-monospace,monospace;
          --ov-shadow: 0 1px 2px rgba(16,25,53,.04), 0 6px 20px rgba(16,25,53,.06);

          background: var(--ov-bg);
          min-height: 100vh;
          padding: 26px 28px 60px;
          font-family: var(--ov-font);
          color: var(--ov-text);
        }

        /* ── Header ── */
        .ov-hd { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:24px; }
        .ov-eyebrow { display:flex; align-items:center; gap:8px; font-size:.7rem; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--ov-accent); margin-bottom:6px; }
        .ov-eyebrow-dot { width:6px; height:6px; border-radius:50%; background:var(--ov-accent); }
        .ov-hd h1 { font-size:1.5rem; font-weight:700; color:var(--ov-navy); letter-spacing:-.02em; margin:0 0 3px; }
        .ov-hd p { font-size:.84rem; color:var(--ov-muted); margin:0; max-width:46ch; }

        .ov-refresh-btn {
          display:inline-flex; align-items:center; gap:8px; font-size:.81rem; font-weight:650;
          background:var(--ov-surface); border:1.5px solid var(--ov-border); color:var(--ov-text);
          padding:9px 16px; border-radius:10px; cursor:pointer; transition:all .15s; font-family:var(--ov-font);
          box-shadow:var(--ov-shadow); flex-shrink:0;
        }
        .ov-refresh-btn:hover:not(:disabled) { border-color:var(--ov-accent); color:var(--ov-accent); background:var(--ov-accent-soft); }
        .ov-refresh-btn:disabled { opacity:.65; cursor:not-allowed; }
        .ov-spin-icon { animation:ovrotate .9s linear infinite; }
        @keyframes ovrotate { to { transform:rotate(360deg); } }

        .ov-alert {
          display:flex; align-items:center; gap:10px; background:var(--ov-amber-soft); color:#8a5108;
          border:1px solid #ffe1a3; border-radius:11px; padding:11px 15px; font-size:.82rem; font-weight:550;
          margin-bottom:20px;
        }

        /* ── Metric grid ── */
        .ov-metric-grid {
          display:grid; grid-template-columns:repeat(4, 1fr); gap:16px; margin-bottom:20px;
        }

        /* ── Main grid ── */
        .ov-grid {
          display:grid;
          grid-template-columns: 1.6fr 1fr;
          gap:18px;
        }
        .ov-card-trends { grid-column:1; grid-row:1; }
        .ov-card-health { grid-column:2; grid-row:1; }
        .ov-card-subjects { grid-column:1; grid-row:2; }
        .ov-card-activity { grid-column:2; grid-row:2; }

        .ov-card {
          background:var(--ov-surface); border:1.5px solid var(--ov-border); border-radius:var(--ov-radius);
          box-shadow:var(--ov-shadow); padding:20px;
        }
        .ov-card-hd { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; gap:10px; }
        .ov-card-hd h3 { font-size:.92rem; font-weight:700; color:var(--ov-navy); margin:0; }
        .ov-pill {
          font-size:.7rem; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
          background:var(--ov-accent-soft); color:var(--ov-accent); padding:4px 10px; border-radius:99px;
        }

        .ov-chart-box { position:relative; width:100%; }
        .ov-chart-box--bar { height:300px; }
        .ov-chart-box--donut { height:220px; }

        /* ── Health rows ── */
        .ov-health-row {
          display:flex; align-items:center; justify-content:space-between; gap:10px;
          padding:11px 10px; border-radius:10px; margin-bottom:4px; transition:background .15s;
        }
        .ov-health-row:hover { background:var(--ov-bg); }
        .ov-health-left { display:flex; align-items:center; gap:10px; min-width:0; }
        .ov-health-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
        .ov-health-dot.ok { background:var(--ov-green); box-shadow:0 0 0 3px var(--ov-green-soft); }
        .ov-health-dot.warn { background:var(--ov-amber); box-shadow:0 0 0 3px var(--ov-amber-soft); }
        .ov-health-label { font-size:.84rem; font-weight:650; color:var(--ov-text); }
        .ov-health-right { text-align:right; flex-shrink:0; }
        .ov-health-status { font-size:.78rem; font-weight:700; display:block; }
        .ov-health-status.ok { color:var(--ov-green); }
        .ov-health-status.warn { color:var(--ov-amber); }
        .ov-health-ms { font-size:.7rem; color:var(--ov-muted); font-family:var(--ov-mono); }

        .ov-storage { margin-top:22px; padding-top:16px; border-top:1px dashed var(--ov-border); }
        .ov-storage-row { display:flex; justify-content:space-between; margin-bottom:8px; font-size:.81rem; }
        .ov-storage-row span:first-child { color:var(--ov-muted); font-weight:550; }
        .ov-storage-pct { font-weight:700; color:var(--ov-text); font-family:var(--ov-mono); }
        .ov-progress-track { height:7px; background:var(--ov-bg); border-radius:99px; overflow:hidden; border:1px solid var(--ov-border); }
        .ov-progress-fill { height:100%; background:linear-gradient(90deg, var(--ov-accent), #5b78ec); border-radius:99px; transition:width .4s ease; }

        /* ── Subject legend ── */
        .ov-legend { margin-top:14px; padding-top:14px; border-top:1px dashed var(--ov-border); display:flex; flex-direction:column; gap:8px; }
        .ov-legend-row { display:flex; align-items:center; gap:9px; font-size:.79rem; }
        .ov-legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .ov-legend-label { color:var(--ov-text); font-weight:550; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ov-legend-count { color:var(--ov-muted); font-family:var(--ov-mono); font-size:.76rem; }

        /* ── Activity feed ── */
        .ov-activity-list { display:flex; flex-direction:column; max-height:340px; overflow-y:auto; }
        .ov-activity-item { display:flex; align-items:flex-start; gap:11px; padding:11px 4px; border-bottom:1px solid #f1f2f8; }
        .ov-activity-item:last-child { border-bottom:none; }
        .ov-activity-icon {
          width:30px; height:30px; border-radius:9px; background:var(--ov-bg); color:var(--ov-muted);
          display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px;
        }
        .ov-activity-body { flex:1; min-width:0; }
        .ov-activity-body p { font-size:.82rem; margin:0 0 2px; color:var(--ov-text); line-height:1.4; }
        .ov-activity-body p span { color:var(--ov-muted); font-weight:450; }
        .ov-activity-time { font-size:.71rem; color:var(--ov-muted); }
        .ov-activity-chevron { flex-shrink:0; color:#c4c8d8; margin-top:6px; }

        .ov-empty-mini {
          display:flex; align-items:center; justify-content:center; height:100%; min-height:120px;
          color:var(--ov-muted); font-size:.82rem; font-weight:550;
        }

        /* ── Loader (also used standalone) ── */
        .ov-spin { width:38px; height:38px; border:3px solid var(--ov-border); border-top-color:var(--ov-accent); border-radius:50%; animation:ovspin .7s linear infinite; }
        @keyframes ovspin { to { transform:rotate(360deg); } }

        /* ══════════════ Responsive ══════════════ */
        @media (max-width:1180px) {
          .ov-metric-grid { grid-template-columns:repeat(2, 1fr); }
          .ov-grid { grid-template-columns:1fr; }
          .ov-card-trends, .ov-card-health, .ov-card-subjects, .ov-card-activity { grid-column:1; }
          .ov-card-trends { grid-row:1; }
          .ov-card-health { grid-row:2; }
          .ov-card-subjects { grid-row:3; }
          .ov-card-activity { grid-row:4; }
        }

        @media (max-width:991px) {
          .ov { padding:20px 18px 50px; }
        }

        @media (max-width:560px) {
          .ov-metric-grid { grid-template-columns:1fr 1fr; gap:12px; }
          .ov-hd h1 { font-size:1.25rem; }
          .ov-refresh-btn { width:100%; justify-content:center; }
          .ov-chart-box--bar { height:240px; }
          .ov-card { padding:16px; }
        }

        @media (max-width:420px) {
          .ov-metric-grid { grid-template-columns:1fr; }
        }
      `}</style>
    </AdminLayout>
  );
}

// ════════════════════════════ Sub-components ════════════════════════════

function Sparkline({ data, accent }: { data?: number[]; accent: string }) {
  if (!data || data.length < 2) return null;
  const w = 64, h = 24, pad = 2;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = (w - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="ov-spark" aria-hidden="true">
      <polyline points={points} fill="none" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={`ov-spark-line ov-spark-${accent}`} />
    </svg>
  );
}

function MetricCard({
  title, value, growth, icon, accent, series,
}: {
  title: string; value?: number; growth?: number; icon: React.ReactNode; accent: string; series?: number[];
}) {
  const isUp = (growth ?? 0) >= 0;
  return (
    <div className="ov-metric-card">
      <div className="ov-metric-top">
        <div className={`ov-metric-icon ov-metric-icon--${accent}`}>{icon}</div>
        {typeof growth === 'number' && (
          <span className={`ov-metric-badge ${isUp ? 'up' : 'down'}`}>
            {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {isUp ? '+' : ''}{growth}%
          </span>
        )}
      </div>
      <p className="ov-metric-title">{title}</p>
      <div className="ov-metric-bottom">
        <h2 className="ov-metric-value">{value?.toLocaleString() ?? 0}</h2>
        <Sparkline data={series} accent={accent} />
      </div>

      <style jsx global>{`
        .ov-metric-card {
          background:var(--ov-surface); border:1.5px solid var(--ov-border); border-radius:var(--ov-radius);
          box-shadow:var(--ov-shadow); padding:18px 18px 16px;
        }
        .ov-metric-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
        .ov-metric-icon {
          width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .ov-metric-icon--blue   { background:var(--ov-accent-soft); color:var(--ov-accent); }
        .ov-metric-icon--green  { background:var(--ov-green-soft);  color:var(--ov-green);  }
        .ov-metric-icon--violet { background:var(--ov-violet-soft); color:var(--ov-violet); }
        .ov-metric-icon--amber  { background:var(--ov-amber-soft); color:var(--ov-amber);  }

        .ov-metric-badge {
          display:inline-flex; align-items:center; gap:3px; font-size:.71rem; font-weight:700;
          padding:4px 8px; border-radius:99px; flex-shrink:0;
        }
        .ov-metric-badge.up   { background:var(--ov-green-soft); color:var(--ov-green); }
        .ov-metric-badge.down { background:var(--ov-red-soft);   color:var(--ov-red);   }

        .ov-metric-title { font-size:.74rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--ov-muted); margin:0 0 6px; }
        .ov-metric-bottom { display:flex; align-items:flex-end; justify-content:space-between; gap:10px; }
        .ov-metric-value { font-size:1.55rem; font-weight:750; color:var(--ov-navy); margin:0; letter-spacing:-.01em; font-family:var(--ov-mono); }

        .ov-spark { flex-shrink:0; opacity:.9; }
        .ov-spark-line.ov-spark-blue   { stroke:var(--ov-accent); }
        .ov-spark-line.ov-spark-green  { stroke:var(--ov-green); }
        .ov-spark-line.ov-spark-violet { stroke:var(--ov-violet); }
        .ov-spark-line.ov-spark-amber  { stroke:var(--ov-amber); }

        @media (max-width:560px) {
          .ov-metric-value { font-size:1.3rem; }
          .ov-metric-card { padding:14px; }
          .ov-spark { display:none; }
        }
      `}</style>
    </div>
  );
}

function HealthRow({ label, status, ms }: { label: string; status?: string; ms?: number }) {
  const isOk = status === 'operational' || status === 'normal';
  return (
    <div className="ov-health-row">
      <div className="ov-health-left">
        <div className={`ov-health-dot ${isOk ? 'ok' : 'warn'}`} />
        <span className="ov-health-label">{label}</span>
      </div>
      <div className="ov-health-right">
        <span className={`ov-health-status ${isOk ? 'ok' : 'warn'}`}>{isOk ? 'Operational' : 'Degraded'}</span>
        <span className="ov-health-ms">{ms ?? '—'}ms</span>
      </div>
    </div>
  );
}