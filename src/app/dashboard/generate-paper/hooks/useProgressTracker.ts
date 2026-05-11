// src/app/dashboard/generate-paper/hooks/useProgressTracker.ts
import { useCallback, useRef } from 'react';

interface ProgressEvent {
  type: 'generation' | 'download' | 'preview';
  status: 'started' | 'in-progress' | 'completed' | 'failed';
  percentage?: number;
  message?: string;
  timestamp: number;
  data?: any;
}

export const useProgressTracker = () => {
  const eventsRef = useRef<ProgressEvent[]>([]);
  const MAX_EVENTS = 50;

  const trackProgress = useCallback(async (result: any) => {
    try {
      // Track generation metrics
      const metrics = {
        success: result.success,
        timestamp: new Date().toISOString(),
        paperId: result.paperId,
        error: result.error,
        duration: result.duration || 0
      };

      // Store event
      const event: ProgressEvent = {
        type: 'generation',
        status: result.success ? 'completed' : 'failed',
        timestamp: Date.now(),
        data: metrics
      };

      eventsRef.current = [event, ...eventsRef.current].slice(0, MAX_EVENTS);

      // Store in localStorage for debugging/offline access
      try {
        const history = JSON.parse(localStorage.getItem('paperGenerationHistory') || '[]');
        history.push({
          ...metrics,
          id: Date.now().toString()
        });
        
        // Keep only last 20 entries
        if (history.length > 20) {
          history.shift();
        }
        
        localStorage.setItem('paperGenerationHistory', JSON.stringify(history));
      } catch (storageError) {
        console.error('Error saving to localStorage:', storageError);
      }

      return metrics;
    } catch (error) {
      console.error('Error tracking progress:', error);
      return null;
    }
  }, []);

  const trackEvent = useCallback((event: Omit<ProgressEvent, 'timestamp'>) => {
    const fullEvent: ProgressEvent = {
      ...event,
      timestamp: Date.now()
    };
    
    eventsRef.current = [fullEvent, ...eventsRef.current].slice(0, MAX_EVENTS);
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Progress event:', fullEvent);
    }
    
    return fullEvent;
  }, []);

  const getGenerationHistory = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem('paperGenerationHistory') || '[]');
    } catch {
      return [];
    }
  }, []);

  const getRecentEvents = useCallback((type?: ProgressEvent['type'], limit: number = 10) => {
    let events = eventsRef.current;
    
    if (type) {
      events = events.filter(e => e.type === type);
    }
    
    return events.slice(0, limit);
  }, []);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem('paperGenerationHistory');
      eventsRef.current = [];
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }, []);

  return {
    trackProgress,
    trackEvent,
    getGenerationHistory,
    getRecentEvents,
    clearHistory
  };
};