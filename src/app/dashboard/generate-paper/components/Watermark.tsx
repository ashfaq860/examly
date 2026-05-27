// components/Watermark.tsx
'use client';
import React from 'react';
import { PaperSettings } from '@/types/paper-builder';

interface WatermarkProps {
  isPremium: boolean;
  logoUrl?: string;
  settings: PaperSettings;
  scale?: number;
  top?: string;
}

export const Watermark: React.FC<WatermarkProps> = ({ 
  isPremium, 
  logoUrl, 
  settings, 
  scale = 1,
  top = '50%'
}) => {
  if (!settings.showWatermark) return null;
  
  const watermarkImg = isPremium && logoUrl ? logoUrl : '/examly.png';
  const width = (settings.watermarkWidth || 400) * scale;
  const height = (settings.watermarkHeight || 400) * scale;
  const opacity = settings.watermarkOpacity || 0.1;

  return (
    <div
      style={{
        position: 'absolute',
        top: top,
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(-30deg)',
        zIndex: 10,
        pointerEvents: 'none',
        opacity,
        width: `${width}px`,
        height: `${height}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 0,
        padding: 0,
        overflow: 'visible',
      }}
    >
      <img 
        src={watermarkImg} 
        alt="watermark" 
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
      />
    </div>
  );
};