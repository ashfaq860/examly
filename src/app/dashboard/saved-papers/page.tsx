// dashboard/saved-papers/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import AcademyLayout from '@/components/AcademyLayout';
import { Search } from 'lucide-react';
import { ArchiveGrid } from './components/ArchiveGrid';
import { PaperPreviewer } from './components/PaperPreviewer';
import Loading from '@/app/dashboard/generate-paper/loading';
export default function SavedPapersPage() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'preview'>('grid');
  const [selectedPaper, setSelectedPaper] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, papersRes] = await Promise.all([
      fetch('/api/profile'),
      supabase.from('papers').select('*').eq('created_by', user.id).order('created_at', { ascending: false })
    ]);

    if (profileRes.ok) {
      const pData = await profileRes.json();
      setProfile(pData?.profile);
    }
    if (!papersRes.error) setPapers(papersRes.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <AcademyLayout><div className="text-center py-5">{<Loading />}</div></AcademyLayout>;

  return (
    <AcademyLayout>
      {viewMode === 'grid' ? (
        <div className="container-fluid">
          <div className="row align-items-center mb-2 g-3">
            <div className="col-md">
              <h1 className="fw-black display-5 mb-1 text-center" style={{ fontWeight: 900 }}>Your Saved Papers</h1>
              <p className="text-muted text-center">Manage your saved papers.</p>
            </div>
            <div className="col-md-auto">
              <div className="position-relative">
                <Search className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" size={18} />
                <input 
                  type="text" 
                  className="form-control ps-5 border-0 shadow-sm" 
                  placeholder="Search..." 
                  style={{ borderRadius: '15px', height: '50px', width: '250px' }}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          <ArchiveGrid 
            papers={papers} 
            searchTerm={searchTerm} 
            onOpen={(p) => { setSelectedPaper(p); setViewMode('preview'); }}
            onDelete={async (e, id) => {
                e.stopPropagation();
                setDeletingId(id);
                await supabase.from('papers').delete().eq('id', id);
                setPapers(papers.filter(p => p.id !== id));
                setDeletingId(null);
            }}
            deletingId={deletingId}
          />
        </div>
      ) : (
        <PaperPreviewer 
          paper={selectedPaper} 
          profile={profile} 
          onBack={() => setViewMode('grid')} 
        />
      )}

      <style jsx global>{`
        .fw-black { font-weight: 900; }
        @media print {
          body * { visibility: hidden; }
          .paper-canvas, .paper-canvas * { visibility: visible; }
          .paper-canvas { position: absolute !important; left: 0; top: 0; width: 210mm !important; box-shadow: none !important; }
        }
      `}</style>
    </AcademyLayout>
  );
}