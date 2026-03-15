'use client';
import React, { useRef, useState, useEffect } from 'react';
import { 
  BookOpen, Filter, Edit3, Save, Printer, Trash2,
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import { is } from 'zod/v4/locales';

interface AppHeaderProps {
  onBoardPattern: () => Promise<void>;
  onConfigurePaper: () => void;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onSavePaper: () => void;
  isSaveDisabled?: boolean;
  onPrint: () => void;
  onCancelPaper: () => void;
  paperSections: any[];
  isLoading?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onBoardPattern,
  onConfigurePaper,
  isEditMode,
  onToggleEditMode,
  onSavePaper,
  isSaveDisabled,
  onPrint,
  onCancelPaper,
  paperSections,
  isLoading = false
}) => {
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 180;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .btn-premium {
          /* Using a high-end cubic-bezier for "organic" feel */
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 10px;
          white-space: nowrap;
          font-weight: 600;
          font-size: 0.85rem;
          padding: 0 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          height: 40px;
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #475569;
          position: relative;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        /* Hover Effect: Elevation + Depth */
        .btn-premium:hover:not(:disabled) {
          transform: translateY(-2px);
          background: #ffffff;
          border-color: #cbd5e1;
          color: #1e293b;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        /* Icon Micro-interaction */
        .btn-premium svg {
          transition: transform 0.2s ease;
        }
        
        .btn-premium:hover:not(:disabled) svg {
          transform: scale(1.15);
        }

        /* Click Interaction: Squeeze */
        .btn-premium:active:not(:disabled) {
          transform: translateY(0px) scale(0.96);
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        /* Specialized styles for Edit Mode Active state */
        .edit-mode-active {
          background: #fffbeb !important;
          border-color: #fbbf24 !important;
          color: #92400e !important;
        }

        .scroll-nav-btn {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
          z-index: 10;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .scroll-nav-btn:hover:not(:disabled) {
            border-color: #cbd5e1;
            transform: scale(1.1);
        }

        .scroll-nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        @media (max-width: 576px) {
          .btn-premium {
            font-size: 0.75rem;
            padding: 0 5px;
            height: 34px;
            gap: 2px;
            border-radius: 8px;
          }
          .scroll-nav-btn {
            width: 24px;
            height: 24px;
          }
        }
      `}</style>

      <header className="bg-white border-bottom sticky-top py-2" style={{ zIndex: 1100 }}>
        <div className="container-fluid d-flex align-items-center position-relative px-1">
          
          <button 
            className="scroll-nav-btn me-1 d-md-none" 
            onClick={() => scroll('left')}
            disabled={!showLeftArrow}
          >
            <ChevronLeft size={16} />
          </button>

          <div 
            ref={scrollRef}
            onScroll={checkScroll}
            className="hide-scrollbar d-flex gap-2 overflow-x-auto w-100 py-1"
          >
            <button onClick={onBoardPattern} disabled={isLoading} className="btn-premium">
              <BookOpen size={16} className="text-primary" />
              <span>Board Pattern</span>
            </button>

            <button onClick={onConfigurePaper} className="btn-premium">
              <Filter size={16} className="text-success" />
              <span>Configure</span>
            </button>

            <button 
              onClick={onToggleEditMode} 
              disabled={paperSections.length === 0}
              className={`btn-premium ${isEditMode ? 'edit-mode-active' : ''}`}
            >
              <Edit3 size={16} className={isEditMode ? "" : "text-muted"} />
              <span>{isEditMode ? 'Done' : 'Edit Mode'}</span>
            </button>

            <button onClick={onSavePaper} disabled={isSaveDisabled || isLoading} className="btn-premium">
              <Save size={16} className={isSaveDisabled ? "text-muted" : "text-secondary"} />
              <span>{isLoading ? 'Saving...' : 'Save'}</span>
            </button>

            <button onClick={onPrint} className="btn-premium">
              <Printer size={16} />
              <span>Print</span>
            </button>

            <button onClick={onCancelPaper} className="btn-premium text-danger">
              <Trash2 size={16} />
              <span>Cancel</span>
            </button>
          </div>

          <button 
            className="scroll-nav-btn ms-1 d-md-none" 
            onClick={() => scroll('right')}
            disabled={!showRightArrow}
          >
            <ChevronRight size={16} />
          </button>

        </div>
      </header>
    </>
  );
};