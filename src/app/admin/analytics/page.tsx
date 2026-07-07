'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import {
  Eye, Users, RefreshCw, AlertCircle, Wallet, CreditCard,
  Gift, ShieldCheck, Smartphone
} from 'lucide-react';

Chart.register(...registerables);

interface VisitStats {
  total_visits: number;
  unique_visitors: number;
  daily: { day: string; visits: number; unique_visitors: number }[];
  top_pages: { path: string; visits: number }[];
  top_referrers: { referrer: string; visits: number }[];
  device_breakdown: { device_type: string; visits: number }[];
}

interface RevenueStats {
  totalRevenue: number;
  thisMonthRevenue: number;
  revenueByMonth: { month: string; revenue: number }[];
  revenueByPackage: { name: string; revenue: number; count: number }[];
  pendingCount: number;
  failedCount: number;
}

interface SubscriptionStats {
  statusCounts: { active: number; inactive: number; canceled: number };
  trialGivenCount: number;
  trialConversionRate: number;
  activeSubscriptions: number;
  expiringSoon: number;
  packagePopularity: { name: string; count: number }[];
}

interface ReferralStats {
  total: number;
  rewarded: number;
  rewardRate: number;
  topReferrers: { name: string; count: number }[];
}

interface AnalyticsData {
  visits: VisitStats | null;
  revenue: RevenueStats | null;
  subscriptions: SubscriptionStats | null;
  referrals: ReferralStats | null;
}

const PALETTE = ['#2f4fe0', '#1d8a52', '#c8473a', '#a3650a', '#6c4fd6', '#101935'];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/auth/login'; return false; }
      const { data: role } = await supabase.rpc('get_user_role', { user_id: user.id });
      const role_ = (role as any)?.role || role;
      if (role_ !== 'admin' && role_ !== 'super_admin') { router.push('/unauthorized'); return false; }
      return true;
    } catch { return false; }
  };

  const fetchData = async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await fetch('/api/admin/analytics', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
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

  const visits = data?.visits;
  const revenue = data?.revenue;
  const subscriptions = data?.subscriptions;
  const referrals = data?.referrals;

  const dailyLineData = {
    labels: visits?.daily?.map(d => d.day.slice(5)) || [],
    datasets: [{
      label: 'Visits',
      data: visits?.daily?.map(d => d.visits) || [],
      borderColor: '#2f4fe0',
      backgroundColor: 'rgba(47, 79, 224, 0.08)',
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      borderWidth: 2,
    }, {
      label: 'Unique visitors',
      data: visits?.daily?.map(d => d.unique_visitors) || [],
      borderColor: '#1d8a52',
      backgroundColor: 'rgba(29, 138, 82, 0.06)',
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      borderWidth: 2,
    }],
  };

  const deviceDoughnutData = {
    labels: visits?.device_breakdown?.map(d => d.device_type) || [],
    datasets: [{
      data: visits?.device_breakdown?.map(d => d.visits) || [],
      backgroundColor: PALETTE,
      borderWidth: 0,
      hoverOffset: 8,
    }],
  };

  const revenueBarData = {
    labels: revenue?.revenueByMonth?.map(m => m.month) || [],
    datasets: [{
      label: 'Revenue',
      data: revenue?.revenueByMonth?.map(m => m.revenue) || [],
      backgroundColor: '#2f4fe0',
      borderRadius: 5,
      maxBarThickness: 30,
    }],
  };

  const subStatusDoughnutData = {
    labels: ['Active', 'Inactive', 'Canceled'],
    datasets: [{
      data: subscriptions ? [
        subscriptions.statusCounts.active,
        subscriptions.statusCounts.inactive,
        subscriptions.statusCounts.canceled,
      ] : [],
      backgroundColor: ['#1d8a52', '#a3650a', '#c8473a'],
      borderWidth: 0,
      hoverOffset: 8,
    }],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'top' as const, labels: { boxWidth: 10, font: { family: 'Lexend', size: 11 } } } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { family: 'Lexend', size: 10 }, color: '#686f8c' } },
      y: { grid: { color: '#eef0f6' }, border: { display: false }, ticks: { font: { family: 'Lexend', size: 11 }, color: '#686f8c' } },
    },
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { family: 'Lexend', size: 10 }, color: '#686f8c' } },
      y: { grid: { color: '#eef0f6' }, border: { display: false }, ticks: { font: { family: 'Lexend', size: 11 }, color: '#686f8c' } },
    },
  };

  if (loading) {
    return (
      <AdminLayout activeTab="analytics">
        <div className="an-loadwrap">
          <div className="an-spin" />
          <p>Crunching platform analytics…</p>
        </div>
        <style jsx global>{`
          .an-loadwrap { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:70vh; gap:14px; font-family:'Lexend','Inter',sans-serif; color:#686f8c; font-size:.86rem; font-weight:550; }
          .an-spin { width:38px; height:38px; border:3px solid #e6e8f1; border-top-color:#2f4fe0; border-radius:50%; animation:anspin .7s linear infinite; }
          @keyframes anspin { to { transform:rotate(360deg); } }
        `}</style>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="analytics">
      <div className="an">
        <div className="an-hd">
          <div>
            <div className="an-eyebrow"><span className="an-eyebrow-dot" />Platform analytics</div>
            <h1>Traffic, Revenue &amp; Referrals</h1>
            <p>Visitor activity from the last 30 days, plus subscription revenue and referral performance.</p>
          </div>
          <button className="an-refresh-btn" onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'an-spin-icon' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </button>
        </div>

        {error && (
          <div className="an-alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* ── Visits ── */}
        <section className="an-section">
          <h2 className="an-section-title">Site visits <span className="an-pill">Last 30 days</span></h2>
          <div className="an-kpi-grid">
            <Kpi label="Total visits" value={(visits?.total_visits ?? 0).toLocaleString()} icon={<Eye size={19} />} accent="blue" />
            <Kpi label="Unique visitors" value={(visits?.unique_visitors ?? 0).toLocaleString()} icon={<Users size={19} />} accent="green" />
          </div>

          <div className="an-grid an-grid-2">
            <div className="an-card an-card-wide">
              <div className="an-card-hd"><h3>Daily traffic</h3></div>
              <div className="an-chart-box an-chart-box--line">
                {visits?.daily?.length ? <Line data={dailyLineData} options={lineChartOptions} /> : <div className="an-empty-mini">No visit data yet</div>}
              </div>
            </div>

            <div className="an-card">
              <div className="an-card-hd"><h3>Devices</h3></div>
              <div className="an-chart-box an-chart-box--donut">
                {visits?.device_breakdown?.length ? <Doughnut data={deviceDoughnutData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '68%' }} /> : <div className="an-empty-mini">No device data yet</div>}
              </div>
              {!!visits?.device_breakdown?.length && (
                <div className="an-legend">
                  {visits.device_breakdown.map((d, i) => (
                    <div className="an-legend-row" key={d.device_type}>
                      <span className="an-legend-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="an-legend-label an-cap">{d.device_type}</span>
                      <span className="an-legend-count">{d.visits.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="an-grid an-grid-2">
            <div className="an-card">
              <div className="an-card-hd"><h3>Top pages</h3></div>
              <StatTable
                columns={['Path', 'Visits']}
                rows={(visits?.top_pages || []).map(p => [p.path, p.visits.toLocaleString()])}
                emptyLabel="No page data yet"
              />
            </div>
            <div className="an-card">
              <div className="an-card-hd"><h3>Top referrers</h3></div>
              <StatTable
                columns={['Referrer', 'Visits']}
                rows={(visits?.top_referrers || []).map(r => [r.referrer, r.visits.toLocaleString()])}
                emptyLabel="No referrer data yet"
              />
            </div>
          </div>
        </section>

        {/* ── Revenue & Subscriptions ── */}
        <section className="an-section">
          <h2 className="an-section-title">Revenue &amp; subscriptions</h2>
          <div className="an-kpi-grid">
            <Kpi label="Total revenue" value={`Rs ${(revenue?.totalRevenue ?? 0).toLocaleString()}`} icon={<Wallet size={19} />} accent="green" />
            <Kpi label="This month" value={`Rs ${(revenue?.thisMonthRevenue ?? 0).toLocaleString()}`} icon={<CreditCard size={19} />} accent="blue" />
            <Kpi label="Active subscriptions" value={(subscriptions?.activeSubscriptions ?? 0).toLocaleString()} icon={<ShieldCheck size={19} />} accent="violet" />
            <Kpi label="Trial → paid" value={`${subscriptions?.trialConversionRate ?? 0}%`} icon={<Smartphone size={19} />} accent="amber" />
          </div>

          <div className="an-grid an-grid-2">
            <div className="an-card an-card-wide">
              <div className="an-card-hd">
                <h3>Monthly revenue</h3>
                <span className="an-pill">Last 12 months</span>
              </div>
              <div className="an-chart-box an-chart-box--bar">
                {revenue?.revenueByMonth?.length ? <Bar data={revenueBarData} options={barChartOptions} /> : <div className="an-empty-mini">No revenue data yet</div>}
              </div>
            </div>

            <div className="an-card">
              <div className="an-card-hd"><h3>Subscription status</h3></div>
              <div className="an-chart-box an-chart-box--donut">
                {subscriptions ? <Doughnut data={subStatusDoughnutData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '68%' }} /> : <div className="an-empty-mini">No subscription data yet</div>}
              </div>
              {subscriptions && (
                <div className="an-legend">
                  <div className="an-legend-row">
                    <span className="an-legend-dot" style={{ background: '#1d8a52' }} />
                    <span className="an-legend-label">Active</span>
                    <span className="an-legend-count">{subscriptions.statusCounts.active.toLocaleString()}</span>
                  </div>
                  <div className="an-legend-row">
                    <span className="an-legend-dot" style={{ background: '#a3650a' }} />
                    <span className="an-legend-label">Inactive</span>
                    <span className="an-legend-count">{subscriptions.statusCounts.inactive.toLocaleString()}</span>
                  </div>
                  <div className="an-legend-row">
                    <span className="an-legend-dot" style={{ background: '#c8473a' }} />
                    <span className="an-legend-label">Canceled</span>
                    <span className="an-legend-count">{subscriptions.statusCounts.canceled.toLocaleString()}</span>
                  </div>
                  <div className="an-legend-row">
                    <span className="an-legend-label an-legend-muted">Expiring in 30 days</span>
                    <span className="an-legend-count">{subscriptions.expiringSoon.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="an-grid an-grid-2">
            <div className="an-card">
              <div className="an-card-hd"><h3>Revenue by package</h3></div>
              <StatTable
                columns={['Package', 'Sales', 'Revenue']}
                rows={(revenue?.revenueByPackage || []).map(p => [p.name, p.count.toLocaleString(), `Rs ${p.revenue.toLocaleString()}`])}
                emptyLabel="No package sales yet"
              />
            </div>
            <div className="an-card">
              <div className="an-card-hd"><h3>Package popularity</h3></div>
              <StatTable
                columns={['Package', 'Active/total holders']}
                rows={(subscriptions?.packagePopularity || []).map(p => [p.name, p.count.toLocaleString()])}
                emptyLabel="No package data yet"
              />
            </div>
          </div>
        </section>

        {/* ── Referrals ── */}
        <section className="an-section">
          <h2 className="an-section-title">Referral program</h2>
          <div className="an-kpi-grid">
            <Kpi label="Total referrals" value={(referrals?.total ?? 0).toLocaleString()} icon={<Gift size={19} />} accent="violet" />
            <Kpi label="Rewarded" value={(referrals?.rewarded ?? 0).toLocaleString()} icon={<ShieldCheck size={19} />} accent="green" />
            <Kpi label="Reward rate" value={`${referrals?.rewardRate ?? 0}%`} icon={<Wallet size={19} />} accent="amber" />
          </div>

          <div className="an-card">
            <div className="an-card-hd"><h3>Top referrers</h3></div>
            <StatTable
              columns={['Name', 'Referrals']}
              rows={(referrals?.topReferrers || []).map(r => [r.name, r.count.toLocaleString()])}
              emptyLabel="No referrals yet"
            />
          </div>
        </section>
      </div>

      <style jsx global>{`
        .an {
          --an-navy: #101935;
          --an-accent: #2f4fe0;
          --an-accent-soft: #eef1ff;
          --an-bg: #f5f6fb;
          --an-surface: #ffffff;
          --an-border: #e6e8f1;
          --an-text: #15192b;
          --an-muted: #686f8c;
          --an-green: #1d8a52;
          --an-green-soft: #e9f9ef;
          --an-amber: #a3650a;
          --an-amber-soft: #fff3bf;
          --an-violet: #6c4fd6;
          --an-violet-soft: #f1eefd;
          --an-red: #c8473a;
          --an-red-soft: #fdeeec;
          --an-radius: 16px;
          --an-font: 'Lexend','Inter',system-ui,sans-serif;
          --an-mono: 'JetBrains Mono',ui-monospace,monospace;
          --an-shadow: 0 1px 2px rgba(16,25,53,.04), 0 6px 20px rgba(16,25,53,.06);

          background: var(--an-bg);
          min-height: 100vh;
          padding: 26px 28px 60px;
          font-family: var(--an-font);
          color: var(--an-text);
        }

        .an-hd { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:24px; }
        .an-eyebrow { display:flex; align-items:center; gap:8px; font-size:.7rem; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--an-accent); margin-bottom:6px; }
        .an-eyebrow-dot { width:6px; height:6px; border-radius:50%; background:var(--an-accent); }
        .an-hd h1 { font-size:1.5rem; font-weight:700; color:var(--an-navy); letter-spacing:-.02em; margin:0 0 3px; }
        .an-hd p { font-size:.84rem; color:var(--an-muted); margin:0; max-width:52ch; }

        .an-refresh-btn {
          display:inline-flex; align-items:center; gap:8px; font-size:.81rem; font-weight:650;
          background:var(--an-surface); border:1.5px solid var(--an-border); color:var(--an-text);
          padding:9px 16px; border-radius:10px; cursor:pointer; transition:all .15s; font-family:var(--an-font);
          box-shadow:var(--an-shadow); flex-shrink:0;
        }
        .an-refresh-btn:hover:not(:disabled) { border-color:var(--an-accent); color:var(--an-accent); background:var(--an-accent-soft); }
        .an-refresh-btn:disabled { opacity:.65; cursor:not-allowed; }
        .an-spin-icon { animation:anrotate .9s linear infinite; }
        @keyframes anrotate { to { transform:rotate(360deg); } }

        .an-alert {
          display:flex; align-items:center; gap:10px; background:var(--an-amber-soft); color:#8a5108;
          border:1px solid #ffe1a3; border-radius:11px; padding:11px 15px; font-size:.82rem; font-weight:550;
          margin-bottom:20px;
        }

        .an-section { margin-bottom:32px; }
        .an-section-title {
          font-size:1rem; font-weight:700; color:var(--an-navy); margin:0 0 14px;
          display:flex; align-items:center; gap:10px;
        }
        .an-pill {
          font-size:.7rem; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
          background:var(--an-accent-soft); color:var(--an-accent); padding:4px 10px; border-radius:99px;
        }

        .an-kpi-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:16px; margin-bottom:16px; }
        .an-kpi {
          background:var(--an-surface); border:1.5px solid var(--an-border); border-radius:var(--an-radius);
          box-shadow:var(--an-shadow); padding:16px 18px; display:flex; align-items:center; gap:13px;
        }
        .an-kpi-icon { width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .an-kpi-icon--blue   { background:var(--an-accent-soft); color:var(--an-accent); }
        .an-kpi-icon--green  { background:var(--an-green-soft);  color:var(--an-green);  }
        .an-kpi-icon--violet { background:var(--an-violet-soft); color:var(--an-violet); }
        .an-kpi-icon--amber  { background:var(--an-amber-soft); color:var(--an-amber);  }
        .an-kpi-label { font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--an-muted); margin:0 0 3px; }
        .an-kpi-value { font-size:1.3rem; font-weight:750; color:var(--an-navy); margin:0; letter-spacing:-.01em; font-family:var(--an-mono); }

        .an-grid { display:grid; gap:18px; margin-bottom:18px; }
        .an-grid-2 { grid-template-columns: 1.6fr 1fr; }

        .an-card {
          background:var(--an-surface); border:1.5px solid var(--an-border); border-radius:var(--an-radius);
          box-shadow:var(--an-shadow); padding:20px;
        }
        .an-card-hd { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; gap:10px; }
        .an-card-hd h3 { font-size:.92rem; font-weight:700; color:var(--an-navy); margin:0; }

        .an-chart-box { position:relative; width:100%; }
        .an-chart-box--bar, .an-chart-box--line { height:260px; }
        .an-chart-box--donut { height:200px; }

        .an-legend { margin-top:14px; padding-top:14px; border-top:1px dashed var(--an-border); display:flex; flex-direction:column; gap:8px; }
        .an-legend-row { display:flex; align-items:center; gap:9px; font-size:.79rem; }
        .an-legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .an-legend-label { color:var(--an-text); font-weight:550; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .an-legend-label.an-cap { text-transform:capitalize; }
        .an-legend-label.an-legend-muted { color:var(--an-muted); font-weight:500; }
        .an-legend-count { color:var(--an-muted); font-family:var(--an-mono); font-size:.76rem; }

        .an-table { width:100%; border-collapse:collapse; font-size:.82rem; }
        .an-table th {
          text-align:left; font-size:.68rem; text-transform:uppercase; letter-spacing:.05em;
          color:var(--an-muted); font-weight:700; padding:0 10px 8px; border-bottom:1px solid var(--an-border);
        }
        .an-table td { padding:9px 10px; border-bottom:1px solid #f1f2f8; color:var(--an-text); }
        .an-table tr:last-child td { border-bottom:none; }
        .an-table td:last-child, .an-table th:last-child { text-align:right; }

        .an-empty-mini {
          display:flex; align-items:center; justify-content:center; height:100%; min-height:120px;
          color:var(--an-muted); font-size:.82rem; font-weight:550;
        }

        @media (max-width:1180px) {
          .an-kpi-grid { grid-template-columns:repeat(2, 1fr); }
          .an-grid-2 { grid-template-columns:1fr; }
        }

        @media (max-width:991px) {
          .an { padding:20px 18px 50px; }
        }

        @media (max-width:560px) {
          .an-kpi-grid { grid-template-columns:1fr 1fr; gap:12px; }
          .an-hd h1 { font-size:1.25rem; }
          .an-refresh-btn { width:100%; justify-content:center; }
          .an-card { padding:16px; }
        }
      `}</style>
    </AdminLayout>
  );
}

function Kpi({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="an-kpi">
      <div className={`an-kpi-icon an-kpi-icon--${accent}`}>{icon}</div>
      <div>
        <p className="an-kpi-label">{label}</p>
        <h2 className="an-kpi-value">{value}</h2>
      </div>
    </div>
  );
}

function StatTable({ columns, rows, emptyLabel }: { columns: string[]; rows: (string | number)[][]; emptyLabel: string }) {
  if (!rows.length) return <div className="an-empty-mini">{emptyLabel}</div>;
  return (
    <table className="an-table">
      <thead>
        <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
