import React, { useState, useMemo } from 'react';
import { Calendar, ChevronRight, Trash2, Clock, AlertCircle, X, Check, BookOpen, Globe } from 'lucide-react';

// ... interfaces remain the same ...

export const ArchiveGrid: React.FC<ArchiveGridProps> = ({ 
  papers, searchTerm, onOpen, onDelete, deletingId 
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const formatClassName = (name: string) => {
    const num = parseInt(name);
    if (isNaN(num)) return name;
    const s = ["th", "st", "nd", "rd"];
    const v = num % 100;
    return num + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const filteredPapers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return papers.filter(p => 
      p.subject_name?.toLowerCase().includes(term) || 
      p.class_name?.toLowerCase().includes(term)
    );
  }, [papers, searchTerm]);

  return (
    <div className="archive-responsive-grid">
      {filteredPapers.map((paper) => {
        const isConfirming = confirmDeleteId === paper.id;
        const isDeleting = deletingId === paper.id;
        const dateObj = new Date(paper.created_at);

        return (
          <div 
            key={paper.id}
            className={`archive-card-compact ${isConfirming ? 'is-confirming' : ''}`}
            onClick={() => !isConfirming && onOpen(paper)}
          >
            {/* Minimalist Background Element */}
            <div className="card-accent-glow" />
            
            <div className="card-inner">
              <div className="card-top">
                <div className="lang-tag">
                  {paper.language.toLowerCase().includes('eng') ? <Globe size={12} /> : <BookOpen size={12} />}
                  <span>{paper.language.toUpperCase()}</span>
                </div>
                <div className="date-group">
                   <span>{dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>

              <div className="card-body">
                <div className="class-info">
                  <span className="class-label">GRADE</span>
                  <h3 className="class-title">{formatClassName(paper.class_name)}</h3>
                </div>
                
                <div className="subject-info">
                  <h4 className="subject-title">{paper.subject_name}</h4>
                  <div className="time-meta">
                    <Clock size={11} />
                    {dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              <div className="card-actions">
                {!isConfirming ? (
                  <>
                    <div className="action-label">View Paper <ChevronRight size={14} className="arrow" /></div>
                    <button 
                      className="btn-trash" 
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(paper.id); }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : (
                  <div className="confirm-overlay">
                    <span className="confirm-text">Delete?</span>
                    <div className="confirm-btns">
                      <button className="btn-yes" onClick={(e) => { e.stopPropagation(); onDelete(e, paper.id); }} disabled={isDeleting}>
                        <Check size={14} />
                      </button>
                      <button className="btn-no" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <style>{`
        /* Container Layout */
        .archive-responsive-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          padding: 16px;
        }

        /* Card Base */
        .archive-card-compact {
          position: relative;
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          overflow: hidden;
        }

        .archive-card-compact:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px -8px rgba(0,0,0,0.08);
          border-color: #6366f1;
        }

        .card-inner {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          z-index: 2;
          position: relative;
        }

        /* Top Row */
        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .lang-tag {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f1f5f9;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
          color: #475569;
        }

        .date-group {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
        }

        /* Body Section */
        .card-body {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 8px 0;
        }

        .class-info {
          display: flex;
          flex-direction: column;
          border-right: 1px solid #f1f5f9;
          padding-right: 16px;
        }

        .class-label { font-size: 9px; color: #94a3b8; font-weight: 800; }
        .class-title { font-size: 20px; font-weight: 900; color: #1e293b; margin: 0; }

        .subject-info { flex: 1; min-width: 0; }
        .subject-title { 
          font-size: 14px; 
          font-weight: 600; 
          color: #334155; 
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .time-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #6366f1;
          margin-top: 2px;
          font-weight: 600;
        }

        /* Actions */
        .card-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
          border-top: 1px solid #f8fafc;
        }

        .action-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: color 0.2s;
        }
        .archive-card-compact:hover .action-label { color: #6366f1; }
        .archive-card-compact:hover .arrow { transform: translateX(3px); transition: 0.2s; }

        .btn-trash {
          background: transparent;
          border: none;
          color: #cbd5e1;
          padding: 4px;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .btn-trash:hover { color: #ef4444; background: #fef2f2; }

        /* Confirmation UI */
        .confirm-overlay {
          display: flex;
          justify-content: space-between;
          width: 100%;
          align-items: center;
        }
        .confirm-text { font-size: 12px; font-weight: 700; color: #ef4444; }
        .confirm-btns { display: flex; gap: 8px; }
        .btn-yes { background: #ef4444; color: white; border: none; border-radius: 6px; padding: 4px 8px; }
        .btn-no { background: #f1f5f9; color: #64748b; border: none; border-radius: 6px; padding: 4px 8px; }

        /* Responsive Tweaks */
        @media (max-width: 600px) {
          .archive-responsive-grid {
            grid-template-columns: 1fr;
            padding: 12px;
          }
          .class-title { font-size: 18px; }
        }

        /* Aesthetic Background Glow */
        .card-accent-glow {
          position: absolute;
          top: -20px;
          right: -20px;
          width: 80px;
          height: 80px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%);
          z-index: 1;
        }
      `}</style>
    </div>
  );
};