import React, { useState, useMemo } from 'react';
import { Calendar, ChevronRight, Trash2, Clock, AlertCircle, X, Check, BookOpen, Globe } from 'lucide-react';

interface Paper {
  id: string;
  subject_name: string;
  class_name: string;
  language: string;
  created_at: string;
}

interface ArchiveGridProps {
  papers: Paper[];
  searchTerm: string;
  onOpen: (paper: Paper) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  deletingId: string | null;
}

export const ArchiveGrid: React.FC<ArchiveGridProps> = ({ 
  papers, 
  searchTerm, 
  onOpen, 
  onDelete, 
  deletingId 
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
    <div className="row g-4 p-2">
      {filteredPapers.map((paper) => {
        const isConfirming = confirmDeleteId === paper.id;
        const isDeleting = deletingId === paper.id;
        const dateObj = new Date(paper.created_at);

        return (
          <div className="col-12 col-md-6 col-lg-4" key={paper.id}>
            <div 
              className={`archive-card-premium h-100 ${isConfirming ? 'confirm-active' : ''}`}
              onClick={() => !isConfirming && onOpen(paper)}
            >
              {/* Subtle Language Background Icon */}
              <div className="bg-icon-floating">
                {paper.language.toLowerCase().includes('eng') ? <Globe size={140} /> : <BookOpen size={140} />}
              </div>

              <div className="card-content p-4">
                {/* TOP ROW: Language and Full Date/Time */}
                <div className="d-flex justify-content-between align-items-start mb-4">
                  <div className="badge-glass">
                    <span className="dot-indicator" />
                    {paper.language.toUpperCase()}
                  </div>
                  
                  <div className="text-end">
                    <div className="meta-pill mb-1">
                      <Calendar size={12} className="me-1" />
                      {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="meta-pill time">
                      <Clock size={12} className="me-1" />
                      {dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* MIDDLE: Class and Subject */}
                <div className="main-info my-4">
                  <h2 className="display-number mb-1">
                    {formatClassName(paper.class_name)} Class
                  </h2>
                  <div className="subject-box">
                    <span className="subject-label">SUBJECT</span>
                    <span className="subject-text">{paper.subject_name}</span>
                  </div>
                </div>

                {/* BOTTOM: Actions */}
                <div className="card-footer-premium pt-3">
                  {!isConfirming ? (
                    <div className="d-flex justify-content-between align-items-center w-100">
                      <div className="view-action">
                        <span>Open Paper</span>
                        <ChevronRight size={18} className="ms-1 arrow-anim" />
                      </div>
                      <button 
                        className="delete-btn-minimal"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(paper.id); }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="delete-flow-container">
                      <div className="d-flex align-items-center text-danger fw-bold small">
                        <AlertCircle size={14} className="me-2 pulse" /> Delete?
                      </div>
                      <div className="d-flex gap-2">
                        <button 
                          className="btn-circle-confirm"
                          onClick={(e) => { e.stopPropagation(); onDelete(e, paper.id); }}
                          disabled={isDeleting}
                        >
                          <Check size={18} />
                        </button>
                        <button 
                          className="btn-circle-cancel"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <style>{`
        .archive-card-premium {
          background: #ffffff;
          border-radius: 28px;
          position: relative;
          border: 1px solid #f1f5f9 !important;
          box-shadow: 0 4px 20px -4px rgba(0, 0, 0, 0.04);
          transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
          overflow: hidden;
          cursor: pointer;
        }

        .archive-card-premium:hover:not(.confirm-active) {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px -12px rgba(79, 70, 229, 0.12);
          border-color: rgba(79, 70, 229, 0.2) !important;
        }

        .bg-icon-floating {
          position: absolute;
          right: -30px;
          top: 40px;
          color: rgba(79, 70, 229, 0.03);
          transform: rotate(-10deg);
          pointer-events: none;
        }

        .badge-glass {
          background: #eff6ff;
          padding: 6px 12px;
          border-radius: 12px;
          color: #2563eb;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .dot-indicator {
          width: 5px;
          height: 5px;
          background: #2563eb;
          border-radius: 50%;
        }

        .meta-pill {
          font-size: 0.75rem;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          font-weight: 500;
        }

        .meta-pill.time {
          color: #4f46e5;
          font-weight: 700;
        }

        .display-number {
          font-size: 3rem;
          font-weight: 950;
          color: #0f172a;
          line-height: 1;
          letter-spacing: -2px;
        }

        .subject-box {
          display: flex;
          flex-direction: column;
          border-left: 3px solid #818cf8;
          padding-left: 12px;
          margin-top: 10px;
        }

        .subject-label {
          font-size: 0.6rem;
          font-weight: 800;
          color: #94a3b8;
          letter-spacing: 0.1em;
        }

        .subject-text {
          font-size: 1.1rem;
          font-weight: 600;
          color: #475569;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-footer-premium {
          border-top: 1px dashed #e2e8f0;
        }

        .view-action {
          color: #4f46e5;
          font-weight: 700;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
        }

        .arrow-anim { transition: transform 0.2s; }
        .archive-card-premium:hover .arrow-anim { transform: translateX(5px); }

        .delete-btn-minimal {
          background: none; border: none; color: #cbd5e1;
          padding: 8px; transition: all 0.2s;
        }
        .delete-btn-minimal:hover { color: #f43f5e; transform: scale(1.1); }

        .confirm-active { border: 1px solid #f43f5e !important; }

        .delete-flow-container {
          display: flex; justify-content: space-between; align-items: center; width: 100%;
        }

        .btn-circle-confirm {
          background: #f43f5e; color: white; border: none;
          width: 32px; height: 32px; border-radius: 10px;
        }
        .btn-circle-cancel {
          background: #f1f5f9; color: #64748b; border: none;
          width: 32px; height: 32px; border-radius: 10px;
        }

        .pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};