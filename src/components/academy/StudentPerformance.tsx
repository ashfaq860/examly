import { Result } from '@/types/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StudentPerformanceProps {
  results: Result[];
}

export default function StudentPerformance({ results }: StudentPerformanceProps) {
  // Transform results for chart
  const chartData = results.map(result => ({
    name: result.users?.name || 'Student',
    score: result.score,
    total: result.total_questions,
    percentage: Math.round((result.score / result.total_questions) * 100),
    date: new Date(result.completed_at).toLocaleDateString(),
    paper: result.papers?.title || 'Paper'
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Student Performance</h2>
      
      {results.length === 0 ? (
        <p className="text-gray-500">No performance data available</p>
      ) : (
        <>
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  formatter={(value) => [`${value}%`, 'Score Percentage']}
                  labelFormatter={(label) => `Student: ${label}`}
                />
                <Bar dataKey="percentage" fill="#8884d8" name="Score Percentage" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paper</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {chartData.map((data, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{data.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{data.paper}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {data.score}/{data.total} ({data.percentage}%)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{data.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}