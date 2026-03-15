import { Paper } from '@/types/types';
import Link from 'next/link';

interface RecentPapersProps {
  papers: Paper[];
}

export default function RecentPapers({ papers }: RecentPapersProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Recent Papers</h2>
        <Link 
          href="/papers/new" 
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition"
        >
          Create New
        </Link>
      </div>

      {papers.length === 0 ? (
        <p className="text-gray-500">No papers created yet</p>
      ) : (
        <div className="space-y-3">
          {papers.map(paper => (
            <Link 
              key={paper.id} 
              href={`/papers/${paper.id}`}
              className="block border-b pb-3 last:border-b-0 last:pb-0 hover:bg-gray-50 p-2 rounded transition"
            >
              <h3 className="font-medium">{paper.title}</h3>
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>Type: {paper.paper_type}</span>
                <span>
                  {new Date(paper.created_at).toLocaleDateString()}
                </span>
              </div>
              {paper.difficulty && (
                <span className="inline-block mt-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                  {paper.difficulty}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}