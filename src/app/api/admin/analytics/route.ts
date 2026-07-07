import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: roleData, error: rpcError } = await supabase
      .rpc('get_user_role', { user_id: session.user.id });

    if (rpcError || (roleData !== 'admin' && roleData !== 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [visits, revenue, subscriptions, referrals] = await Promise.all([
      getVisitStats(supabase),
      getRevenueStats(),
      getSubscriptionStats(),
      getReferralStats(),
    ]);

    return NextResponse.json({ visits, revenue, subscriptions, referrals });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Runs through the session-scoped client (not supabaseAdmin) because
// get_visit_stats() checks auth.uid() internally — a service-role call
// would carry no user id and would be rejected by its own admin guard.
async function getVisitStats(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  try {
    const { data, error } = await supabase.rpc('get_visit_stats', { days_back: 30 });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching visit stats:', error);
    return null;
  }
}

async function getRevenueStats() {
  if (!supabaseAdmin) return null;

  try {
    const { data: payments, error } = await supabaseAdmin
      .from('payments')
      .select('amount, status, created_at, package_id');
    if (error) throw error;

    const completed = (payments || []).filter(p => p.status === 'completed');
    const totalRevenue = completed.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthRevenue = completed
      .filter(p => new Date(p.created_at) >= currentMonthStart)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // Last 12 months revenue trend
    const monthlyRevenue: Record<string, number> = {};
    const monthLabels: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthLabels.push(label);
      monthlyRevenue[label] = 0;
    }
    completed.forEach(p => {
      const label = new Date(p.created_at).toLocaleString('default', { month: 'short', year: '2-digit' });
      if (label in monthlyRevenue) monthlyRevenue[label] += Number(p.amount || 0);
    });
    const revenueByMonth = monthLabels.map(month => ({
      month,
      revenue: Math.round(monthlyRevenue[month] * 100) / 100,
    }));

    const pendingCount = (payments || []).filter(p => p.status === 'pending').length;
    const failedCount = (payments || []).filter(p => p.status === 'failed').length;

    const { data: packages } = await supabaseAdmin.from('packages').select('id, name');
    const packageMap = new Map((packages || []).map(pk => [pk.id, pk.name]));

    const byPackage: Record<string, { name: string; revenue: number; count: number }> = {};
    completed.forEach(p => {
      const name = packageMap.get(p.package_id) || 'Unknown';
      if (!byPackage[name]) byPackage[name] = { name, revenue: 0, count: 0 };
      byPackage[name].revenue += Number(p.amount || 0);
      byPackage[name].count += 1;
    });
    const revenueByPackage = Object.values(byPackage)
      .map(p => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      thisMonthRevenue: Math.round(thisMonthRevenue * 100) / 100,
      revenueByMonth,
      revenueByPackage,
      pendingCount,
      failedCount,
    };
  } catch (error) {
    console.error('Error fetching revenue stats:', error);
    return null;
  }
}

async function getSubscriptionStats() {
  if (!supabaseAdmin) return null;

  try {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_status, trial_given')
      .in('role', ['teacher', 'academy', 'student']);
    if (profilesError) throw profilesError;

    const statusCounts = { active: 0, inactive: 0, canceled: 0 };
    let trialGivenCount = 0;
    let trialConvertedCount = 0;
    (profiles || []).forEach(p => {
      if (p.subscription_status && p.subscription_status in statusCounts) {
        statusCounts[p.subscription_status as keyof typeof statusCounts]++;
      }
      if (p.trial_given) {
        trialGivenCount++;
        if (p.subscription_status === 'active') trialConvertedCount++;
      }
    });
    const trialConversionRate = trialGivenCount > 0
      ? Math.round((trialConvertedCount / trialGivenCount) * 100)
      : 0;

    const { data: userPackages, error: upError } = await supabaseAdmin
      .from('user_packages')
      .select('is_active, expires_at, package_id');
    if (upError) throw upError;

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const activeSubscriptions = (userPackages || []).filter(
      u => u.is_active && (!u.expires_at || new Date(u.expires_at) > now)
    ).length;
    const expiringSoon = (userPackages || []).filter(
      u => u.is_active && u.expires_at && new Date(u.expires_at) > now && new Date(u.expires_at) <= in30Days
    ).length;

    const { data: packages } = await supabaseAdmin.from('packages').select('id, name');
    const packageMap = new Map((packages || []).map(pk => [pk.id, pk.name]));

    const popularity: Record<string, number> = {};
    (userPackages || []).forEach(u => {
      const name = packageMap.get(u.package_id) || 'Unknown';
      popularity[name] = (popularity[name] || 0) + 1;
    });
    const packagePopularity = Object.entries(popularity)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      statusCounts,
      trialGivenCount,
      trialConversionRate,
      activeSubscriptions,
      expiringSoon,
      packagePopularity,
    };
  } catch (error) {
    console.error('Error fetching subscription stats:', error);
    return null;
  }
}

async function getReferralStats() {
  if (!supabaseAdmin) return null;

  try {
    const { data: referrals, error } = await supabaseAdmin
      .from('referrals')
      .select('id, referrer_id, reward_given, created_at');
    if (error) throw error;

    const total = referrals?.length || 0;
    const rewarded = (referrals || []).filter(r => r.reward_given).length;
    const rewardRate = total > 0 ? Math.round((rewarded / total) * 100) : 0;

    const counts: Record<string, number> = {};
    (referrals || []).forEach(r => {
      counts[r.referrer_id] = (counts[r.referrer_id] || 0) + 1;
    });
    const topReferrerIds = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    const { data: profiles } = topReferrerIds.length
      ? await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', topReferrerIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
    const nameMap = new Map((profiles || []).map(p => [p.id, p.full_name || p.email || 'Unknown']));

    const topReferrers = topReferrerIds.map(id => ({
      name: nameMap.get(id) || 'Unknown',
      count: counts[id],
    }));

    return { total, rewarded, rewardRate, topReferrers };
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    return null;
  }
}
