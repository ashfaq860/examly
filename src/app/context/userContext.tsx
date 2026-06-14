// src/app/context/userContext.tsx
'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const supabase = createSupabaseBrowserClient();

interface TrialStatus {
  isTrial: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
  hasActiveSubscription: boolean;
  papersGenerated: number;
  papersRemaining: number | 'unlimited';
  subscriptionName?: string | null;
  subscriptionType?: 'paper_pack' | 'subscription' | null;
  subscriptionEndDate?: Date | null;
  message?: string | null;
  referral_code?: string | null;
}

interface UserContextType {
  trialStatus: TrialStatus | null;
  isLoading: boolean;
  refreshTrialStatus: (silent?: boolean) => Promise<void>;
  incrementPapersGenerated: () => void;
  error: string | null;
}

const UserContext = createContext<UserContextType>({
  trialStatus: null,
  isLoading: true,
  refreshTrialStatus: async () => {},
  incrementPapersGenerated: () => {},
  error: null
});

export const useUser = () => useContext(UserContext);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ Added a silent parameter to prevent layout unmounting on re-fetch
  const fetchTrialStatus = async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.log('No active session found');
        setTrialStatus({
          isTrial: false,
          trialEndsAt: null,
          daysRemaining: 0,
          hasActiveSubscription: false,
          papersGenerated: 0,
          papersRemaining: 0,
          referral_code: null
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/api/user/trial-status?userId=${session.user.id}`);
      
      if (!response.ok) {
        console.warn('Trial status unavailable:', response.status);
        setTrialStatus({
          isTrial: false,
          trialEndsAt: null,
          daysRemaining: 0,
          hasActiveSubscription: false,
          papersGenerated: 0,
          papersRemaining: 0,
          referral_code: null
        });
        return;
      }

      const trialData = await response.json();

      setTrialStatus({
        isTrial: trialData.isTrial,
        trialEndsAt: trialData.trialEndsAt ? new Date(trialData.trialEndsAt) : null,
        daysRemaining: trialData.daysRemaining,
        hasActiveSubscription: trialData.hasActiveSubscription,
        papersGenerated: trialData.papersGenerated,
        papersRemaining: trialData.papersRemaining,
        subscriptionName: trialData.subscriptionName,
        subscriptionType: trialData.subscriptionType,
        referral_code: trialData.referral_code,
        subscriptionEndDate: trialData.subscriptionEndDate ? new Date(trialData.subscriptionEndDate) : null,
        message: trialData.message || null
      });
    } catch (error) {
      console.error('Error fetching trial status:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setTrialStatus({
        isTrial: false,
        trialEndsAt: null,
        daysRemaining: 0,
        hasActiveSubscription: false,
        papersGenerated: 0,
        papersRemaining: 0,
        referral_code: null
      });
    } finally {
      setIsLoading(false);
    }
  };

  const incrementPapersGenerated = () => {
    setTrialStatus(prev => {
      if (!prev) return prev;

      const newPapersGenerated = prev.papersGenerated + 1;
      
      const newPapersRemaining = prev.isTrial ? 'unlimited' : 
        (prev.papersRemaining !== 'unlimited' && prev.papersRemaining !== Infinity)
          ? Math.max(0, prev.papersRemaining - 1)
          : prev.papersRemaining;

      return {
        ...prev,
        papersGenerated: newPapersGenerated,
        papersRemaining: newPapersRemaining
      };
    });
  };

  useEffect(() => {
    // First load requires a true loading state
    fetchTrialStatus(false);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, _session) => {
      // ✅ Optimization: Silently update the session in the background on route changes 
      // without setting isLoading = true if we already have active state.
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        fetchTrialStatus(true);
      } else {
        fetchTrialStatus(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    trialStatus,
    isLoading,
    refreshTrialStatus: () => fetchTrialStatus(true), // defaults manual refreshes to silent background updates
    incrementPapersGenerated,
    error
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};