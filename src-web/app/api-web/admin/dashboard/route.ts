import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  try {
    // Await cookies() before using it - FIX for Next.js 15+
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is admin
    const { data: roleData, error: rpcError } = await supabase
      .rpc('get_user_role', { user_id: session.user.id })
    
    if (rpcError || roleData !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all data including system status
    const [
      teacherCount,
      studentCount,
      academyCount,
      paperCount,
      questionCount,
      papersByMonth,
      questionsBySubject,
      recentActivities,
      growthRates,
      avgPapersPerUser,
      systemStatus
    ] = await Promise.all([
      getTeacherCount(),
      getStudentCount(),
      getAcademyCount(),
      getPaperCount(),
      getQuestionCount(),
      getPapersByMonth(),
      getQuestionsBySubject(),
      getRecentActivities(),
      getGrowthRates(),
      getAvgPapersPerUser(),
      getSystemStatus()
    ]);

    return NextResponse.json({
      teacherCount,
      studentCount,
      academyCount,
      paperCount,
      questionCount,
      papersByMonth,
      questionsBySubject,
      recentActivities,
      growthRates,
      avgPapersPerUser,
      systemStatus
    })
    
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions to get real data
async function getTeacherCount() {
  if (!supabaseAdmin) return 0;
  const { count, error } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact' })
    .eq('role', 'teacher');
  return error ? 0 : count || 0;
}

async function getStudentCount() {
  if (!supabaseAdmin) return 0;
  const { count, error } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact' })
    .eq('role', 'student');
  return error ? 0 : count || 0;
}

async function getAcademyCount() {
  if (!supabaseAdmin) return 0;
  const { count, error } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact' })
    .eq('role', 'academy');
  return error ? 0 : count || 0;
}

async function getPaperCount() {
  if (!supabaseAdmin) return 0;
  const { count, error } = await supabaseAdmin
    .from('papers')
    .select('*', { count: 'exact' });
  return error ? 0 : count || 0;
}

async function getQuestionCount() {
  if (!supabaseAdmin) return 0;
  const { count, error } = await supabaseAdmin
    .from('questions')
    .select('*', { count: 'exact' });
  return error ? 0 : count || 0;
}

async function getPapersByMonth() {
  if (!supabaseAdmin) return [];
  
  try {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).toISOString();
    
    const { data: papers, error } = await supabaseAdmin
      .from('papers')
      .select('created_at')
      .gte('created_at', startOfYear);

    if (error) return [];

    const monthlyCounts: Record<string, number> = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Initialize all months with 0
    monthNames.forEach(month => {
      monthlyCounts[month] = 0;
    });

    // Count papers by month
    papers?.forEach(paper => {
      const month = new Date(paper.created_at).toLocaleString('default', { month: 'short' });
      monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
    });

    return monthNames.map(month => ({ month, count: monthlyCounts[month] }));
  } catch (error) {
    console.error('Error fetching papers by month:', error);
    return [];
  }
}

async function getQuestionsBySubject() {
  if (!supabaseAdmin) return [];
  
  try {
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select('subject_id');

    if (questionsError) return [];

    const { data: subjects, error: subjectsError } = await supabaseAdmin
      .from('subjects')
      .select('id, name');

    if (subjectsError) return [];

    const subjectMap = new Map();
    subjects?.forEach(subject => {
      subjectMap.set(subject.id, subject.name);
    });

    const subjectCounts: Record<string, number> = {};
    questions?.forEach(question => {
      const subjectName = subjectMap.get(question.subject_id) || 'Unknown Subject';
      subjectCounts[subjectName] = (subjectCounts[subjectName] || 0) + 1;
    });

    return Object.entries(subjectCounts)
      .map(([subject_name, count]) => ({ subject_name, count }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('Error fetching questions by subject:', error);
    return [];
  }
}
async function getRecentActivities() {
  if (!supabaseAdmin) return [];
  
  try {
    // Get recent question additions
    const { data: recentQuestions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select('id, created_at, created_by, subject_id')
      .order('created_at', { ascending: false })
      .limit(5);

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      return [];
    }

    // Get user IDs for lookup - these are auth.user IDs
    const userIds = [
      ...(recentQuestions?.map(q => q.created_by) || [])
    ].filter((id, index, arr) => id && arr.indexOf(id) === index);

    // Fetch user emails from auth.users table (not profiles)
    const { data: users, error: usersError } = userIds.length > 0 ? 
      await supabaseAdmin.auth.admin.listUsers() : { data: null, error: null };

    if (usersError) {
      console.error('Error fetching auth users:', usersError);
    }

    // Also fetch profile names for those who have profiles
    const { data: profiles, error: profilesError } = userIds.length > 0 ? 
      await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds) : { data: null, error: null };

    if (profilesError) console.error('Error fetching profiles:', profilesError);

    // Fetch subject names
    const subjectIds = [
      ...(recentQuestions?.map(q => q.subject_id) || [])
    ].filter((id, index, arr) => id && arr.indexOf(id) === index);

    const { data: subjects, error: subjectsError } = subjectIds.length > 0 ?
      await supabaseAdmin
        .from('subjects')
        .select('id, name') : { data: null, error: null };

    if (subjectsError) console.error('Error fetching subjects:', subjectsError);

    // Create lookup maps
    const userMap = new Map();
    
    // First, try to get names from profiles
    profiles?.forEach(profile => {
      userMap.set(profile.id, profile.full_name);
    });

    // Then, fill in with emails from auth users for those without profiles
    users?.users?.forEach(user => {
      if (!userMap.has(user.id)) {
        userMap.set(user.id, user.email || 'Unknown User');
      }
    });

    const subjectMap = new Map();
    subjects?.forEach(subject => subjectMap.set(subject.id, subject.name));

    // Combine and format activities
    const activities = [];

    // Add question creation activities
    if (recentQuestions) {
      for (const question of recentQuestions) {
        const userName = userMap.get(question.created_by) || 'Unknown User';
        const subjectName = subjectMap.get(question.subject_id) || 'Unknown Subject';
        
        activities.push({
          type: 'question_added',
          subject: subjectName,
          user: userName,
          timestamp: question.created_at,
          id: question.id
        });
      }
    }

    // Sort by timestamp and return top 5
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return [];
  }
}

async function getGrowthRates() {
  if (!supabaseAdmin) return {
    teacherGrowth: 0,
    studentGrowth: 0,
    academyGrowth: 0,
    paperGrowth: 0
  };
  
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get current month counts
    const [
      currentTeachers,
      currentStudents,
      currentAcademies,
      currentPapers
    ] = await Promise.all([
      getCountForPeriod('profiles', 'created_at', currentMonthStart, now, { role: 'teacher' }),
      getCountForPeriod('profiles', 'created_at', currentMonthStart, now, { role: 'student' }),
      getCountForPeriod('profiles', 'created_at', currentMonthStart, now, { role: 'academy' }),
      getCountForPeriod('papers', 'created_at', currentMonthStart, now)
    ]);

    // Get previous month counts
    const [
      previousTeachers,
      previousStudents,
      previousAcademies,
      previousPapers
    ] = await Promise.all([
      getCountForPeriod('profiles', 'created_at', previousMonthStart, previousMonthEnd, { role: 'teacher' }),
      getCountForPeriod('profiles', 'created_at', previousMonthStart, previousMonthEnd, { role: 'student' }),
      getCountForPeriod('profiles', 'created_at', previousMonthStart, previousMonthEnd, { role: 'academy' }),
      getCountForPeriod('papers', 'created_at', previousMonthStart, previousMonthEnd)
    ]);

    // Calculate growth rates
    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      teacherGrowth: calculateGrowth(currentTeachers, previousTeachers),
      studentGrowth: calculateGrowth(currentStudents, previousStudents),
      academyGrowth: calculateGrowth(currentAcademies, previousAcademies),
      paperGrowth: calculateGrowth(currentPapers, previousPapers)
    };

  } catch (error) {
    console.error('Error calculating growth rates:', error);
    return {
      teacherGrowth: 0,
      studentGrowth: 0,
      academyGrowth: 0,
      paperGrowth: 0
    };
  }
}

async function getCountForPeriod(
  table: string, 
  dateField: string, 
  startDate: Date, 
  endDate: Date,
  additionalFilters: any = {}
) {
  if (!supabaseAdmin) return 0;
  
  let query = supabaseAdmin
    .from(table)
    .select('*', { count: 'exact' })
    .gte(dateField, startDate.toISOString())
    .lte(dateField, endDate.toISOString());

  // Apply additional filters
  Object.entries(additionalFilters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { count, error } = await query;
  return error ? 0 : count || 0;
}

async function getAvgPapersPerUser() {
  if (!supabaseAdmin) return 0;
  
  try {
    // Get total paper count
    const { count: paperCount, error: paperError } = await supabaseAdmin
      .from('papers')
      .select('*', { count: 'exact' });

    if (paperError) throw paperError;

    // Get total user count (all roles except admin)
    const { count: userCount, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' })
      .in('role', ['teacher', 'student', 'academy']);

    if (userError) throw userError;

    return userCount && userCount > 0 ? Math.round(paperCount / userCount) : 0;
  } catch (error) {
    console.error('Error calculating avg papers per user:', error);
    return 0;
  }
}

async function getSystemStatus() {
  if (!supabaseAdmin) {
    return {
      apiStatus: 'unknown',
      databaseStatus: 'unknown',
      storageStatus: 'unknown'
    };
  }

  try {
    // Check API and database status with a simple query
    const apiStartTime = Date.now();
    const { error, count } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    const apiResponseTime = Date.now() - apiStartTime;
    
    const apiStatus = !error && apiResponseTime < 2000 ? 'operational' : 
                     apiResponseTime < 5000 ? 'degraded' : 'down';
    
    const databaseStatus = !error && apiResponseTime < 1000 ? 'normal' : 
                          apiResponseTime < 3000 ? 'slow' : 'down';

    // Check storage usage (approximate)
    const { count: totalQuestions, error: storageError } = await supabaseAdmin
      .from('questions')
      .select('*', { count: 'exact' });
    
    // Adjust storage limit based on your actual needs
    const storageLimit = 100000;
    const storageUsed = totalQuestions || 0;
    const storagePercentage = Math.min(100, Math.round((storageUsed / storageLimit) * 100));
    
    const storageStatus = storagePercentage < 80 ? 'good' :
                         storagePercentage < 95 ? 'warning' : 'critical';

    return {
      apiStatus,
      databaseStatus,
      storageStatus,
      storagePercentage,
      storageUsed,
      storageLimit,
      apiResponseTime,
      dbResponseTime: apiResponseTime
    };

  } catch (error) {
    console.error('Error checking system status:', error);
    return {
      apiStatus: 'unknown',
      databaseStatus: 'unknown',
      storageStatus: 'unknown',
      storagePercentage: 0,
      storageUsed: 0,
      storageLimit: 0,
      apiResponseTime: 0,
      dbResponseTime: 0
    };
  }
}