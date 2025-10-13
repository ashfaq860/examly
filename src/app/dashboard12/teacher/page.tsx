// src/app/dashboard/teacher/page.tsx
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';

export default function TeacherDashboard() {
  const { profile } = useAuth();
  // optional: check profile.role === 'teacher' and redirect/deny if not
  return (
    <ProtectedRoute>
      <div className="p-6">
        <h2 className="text-xl">Teacher Dashboard</h2>
        <p>Welcome, {profile?.full_name ?? profile?.id}</p>
      </div>
    </ProtectedRoute>
  );
}
