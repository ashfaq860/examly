import { Subject, ClassSubject } from '@/types/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface SubjectStatsProps {
  subjects: Subject[];
  classSubjects: ClassSubject[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function SubjectStats({ subjects, classSubjects }: SubjectStatsProps) {
  // Count how many classes each subject is assigned to
  const subjectCounts = subjects.map(subject => {
    const count = classSubjects.filter(cs => cs.subject_id === subject.id).length;
    return {
      name: subject.name,
      value: count,
      id: subject.id
    };
  }).filter(item => item.value > 0);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Subject Distribution</h2>
      
      {subjectCounts.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={subjectCounts}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {subjectCounts.map((entry, index) => (
                  <Cell key={`cell-${entry.id}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-gray-500">No subject data available</p>
      )}
    </div>
  );
}