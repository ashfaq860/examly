// dashboard/saved-papers/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Search, Archive, FilePlus } from 'lucide-react';
import { ArchiveGrid } from './components/ArchiveGrid';
import { PaperPreviewer } from './components/PaperPreviewer';
import Loading from '@/app/dashboard/generate-paper/loading';
export default function SavedPapersPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
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

  if (loading) return <><div className="text-center py-5">{<Loading />}</div></>;

  return (
    <>
      {viewMode === 'grid' ? (
        <div>
          {/* Page header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(7,62,140,0.25)',
              }}>
                <Archive size={20} color="#fff" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>Your Saved Papers</h1>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {papers.length} paper{papers.length === 1 ? '' : 's'} in your library
                </p>
              </div>
            </div>

            <div style={{ position: 'relative', minWidth: 240 }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by class or subject..."
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', padding: '0.65rem 0.9rem 0.65rem 2.4rem', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)', background: '#fff', fontSize: '0.85rem',
                  fontFamily: 'inherit', outline: 'none', boxShadow: 'var(--shadow-xs)',
                }}
              />
            </div>
          </div>

          {papers.length === 0 ? (
            <div style={{
              background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)',
              padding: '3.5rem 1rem', textAlign: 'center',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1rem',
                background: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Archive size={24} style={{ opacity: 0.4 }} />
              </div>
              <p style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.9rem', color: 'var(--text-main)' }}>No saved papers yet</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
                Generate your first paper and it will show up here.
              </p>
              <button
                onClick={() => router.push('/dashboard/generate-paper')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.6rem 1.4rem',
                  border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.85rem',
                  color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                  background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
                }}
              >
                <FilePlus size={16} /> Generate Paper
              </button>
            </div>
          ) : (
            <ArchiveGrid
              papers={papers}
              searchTerm={searchTerm}
              onOpen={(p: any) => { setSelectedPaper(p); setViewMode('preview'); }}
              onDelete={async (e: React.MouseEvent, id: string) => {
                  e.stopPropagation();
                  setDeletingId(id);
                  await supabase.from('papers').delete().eq('id', id);
                  setPapers(papers.filter((p: any) => p.id !== id));
                  setDeletingId(null);
              }}
              deletingId={deletingId}
            />
          )}
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
    </>
  );
}