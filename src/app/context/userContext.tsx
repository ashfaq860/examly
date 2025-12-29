// Update the UserContext to handle unlimited papers
// examly/src/app/context/userContext.tsx
'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const supabase = createClientComponentClient();

interface TrialStatus {
  isTrial: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
  hasActiveSubscription: boolean;
  papersGenerated: number;
  papersRemaining: number | 'unlimited'; // Changed to support unlimited
  subscriptionName?: string | null;
  subscriptionType?: 'paper_pack' | 'subscription' | null;
  subscriptionEndDate?: Date | null;
   message?: string | null;   // <-- added
}

interface UserContextType {
  trialStatus: TrialStatus | null;
  isLoading: boolean;
  refreshTrialStatus: () => Promise<void>;
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

  const fetchTrialStatus = async () => {
    setIsLoading(true);
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
          papersRemaining: 0
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/api/user/trial-status?userId=${session.user.id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setTrialStatus({
            isTrial: false,
            trialEndsAt: null,
            daysRemaining: 0,
            hasActiveSubscription: false,
            papersGenerated: 0,
            papersRemaining: 0
          });
          return;
        }
        throw new Error(`Failed to fetch trial status: ${response.statusText}`);
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
        subscriptionEndDate: trialData.subscriptionEndDate ? new Date(trialData.subscriptionEndDate) : null,
        message: trialData.message || null   // <-- added
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
        papersRemaining: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const incrementPapersGenerated = () => {
    setTrialStatus(prev => {
      if (!prev) return prev;

      const newPapersGenerated = prev.papersGenerated + 1;
      
      // For trial users, papers remain unlimited
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
    fetchTrialStatus();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, _session) => {
      fetchTrialStatus();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    trialStatus,
    isLoading,
    refreshTrialStatus: fetchTrialStatus,
    incrementPapersGenerated,
    error
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};