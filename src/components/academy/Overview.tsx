import { Academy, Profile } from '@/types/types';

interface OverviewProps {
  academy: Academy | null;
  role: string;
  classCount: number;
  subjectCount: number;
}

export default function AcademyOverview({ academy, role, classCount, subjectCount }: OverviewProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Overview</h2>
      
      {academy && (
        <div className="mb-6">
          <p className="text-gray-600 mb-2">Academy Name: <span className="font-medium text-gray-800">{academy.name}</span></p>
          {academy.address && (
            <p className="text-gray-600">Address: <span className="font-medium text-gray-800">{academy.address}</span></p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-blue-800">Classes</h3>
          <p className="text-3xl font-bold text-blue-600">{classCount}</p>
          <p className="text-sm text-blue-500">Total classes</p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-green-800">Subjects</h3>
          <p className="text-3xl font-bold text-green-600">{subjectCount}</p>
          <p className="text-sm text-green-500">Available subjects</p>
        </div>

        {role === 'teacher' && (
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-purple-800">Role</h3>
            <p className="text-xl font-bold text-purple-600">Teacher</p>
            <p className="text-sm text-purple-500">Account type</p>
          </div>
        )}
      </div>
    </div>
  );
}