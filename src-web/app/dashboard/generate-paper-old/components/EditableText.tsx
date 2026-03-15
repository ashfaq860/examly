'use client';
import React, { useRef, useEffect } from 'react';

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  className?: string;
}

export const EditableText: React.FC<EditableTextProps> = ({
  value,
  onChange,
  style,
  className = '',
}) => {
  const elementRef = useRef<HTMLDivElement>(null);

  // Update the element text if the value prop changes externally
  useEffect(() => {
    if (elementRef.current && elementRef.current.innerHTML !== value) {
      elementRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleBlur = () => {
    if (elementRef.current) {
      const newValue = elementRef.current.innerHTML;
      if (newValue !== value) {
        onChange(newValue);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Save on Ctrl+Enter
    if (e.key === 'Enter' && e.ctrlKey) {
      elementRef.current?.blur();
    }
  };

  return (
    <div
      ref={elementRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`${className} editable-content`}
      style={{
        ...style,
        outline: 'none',
        minWidth: '20px',
        minHeight: '1.2em',
        cursor: 'text',
        transition: 'background-color 0.2s',
        border: '1px dashed transparent',
        borderRadius: '2px',
        padding: '0 2px'
      }}
      onFocus={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(0, 123, 255, 0.05)';
        e.currentTarget.style.borderColor = '#007bff';
      }}
      onMouseLeave={(e) => {
        if (document.activeElement !== e.currentTarget) {
          e.currentTarget.style.borderColor = 'transparent';
        }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#007bff';
      }}
      // Use dangerouslySetInnerHTML for initial render only
      dangerouslySetInnerHTML={{ __html: value || '' }}
    />
  );
};