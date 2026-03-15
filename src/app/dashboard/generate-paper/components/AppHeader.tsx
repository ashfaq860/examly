'use client';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, Filter, Edit3, Save, Printer, Trash2,
  ChevronLeft, ChevronRight 
} from 'lucide-react';

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
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Use Callback for performance and to use in ResizeObserver
  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      // Show arrows only if content is wider than container
      const isOverflowing = scrollWidth > clientWidth;
      setShowLeftArrow(isOverflowing && scrollLeft > 10);
      setShowRightArrow(isOverflowing && scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    // Monitor resize of the element itself, not just the window
    const resizeObserver = new ResizeObserver(() => checkScroll());
    resizeObserver.observe(scrollEl);
    
    checkScroll();
    return () => resizeObserver.disconnect();
  }, [checkScroll, paperSections]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.6;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="header-wrapper w-100 d-flex align-items-center px-2">
      {/* Left Arrow */}
      {showLeftArrow && (
        <button 
          className="scroll-nav-btn left-fade" 
          onClick={() => scroll('left')}
          aria-label="Scroll left"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      {/* Main Scrollable Area */}
      <div 
        ref={scrollRef}
        onScroll={checkScroll}
        className="hide-scrollbar d-flex align-items-center gap-2 overflow-x-auto w-100 py-2"
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
          <Edit3 size={16} className={isEditMode ? "text-warning" : "text-muted"} />
          <span>{isEditMode ? 'Done' : 'Edit Mode'}</span>
        </button>

        <button 
          onClick={onSavePaper} 
          disabled={isSaveDisabled || isLoading} 
          className="btn-premium"
        >
          <Save size={16} className={isSaveDisabled ? "text-muted" : "text-info"} />
          <span>{isLoading ? 'Saving...' : 'Save'}</span>
        </button>

        <button onClick={onPrint} className="btn-premium">
          <Printer size={16} className="text-dark" />
          <span>Print</span>
        </button>

        <button onClick={onCancelPaper} className="btn-premium text-danger border-danger-subtle">
          <Trash2 size={16} />
          <span>Cancel</span>
        </button>
      </div>

      {/* Right Arrow */}
      {showRightArrow && (
        <button 
          className="scroll-nav-btn right-fade" 
          onClick={() => scroll('right')}
          aria-label="Scroll right"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
};