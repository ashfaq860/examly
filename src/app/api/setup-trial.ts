// pages/api/setup-trial.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Calculate trial end date (7 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    // Update user profile with trial information
    const { error } = await supabase
      .from('profiles')
      .update({
        trial_ends_at: trialEndsAt.toISOString(),
        subscription_status: 'inactive'
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    res.status(200).json({ 
      success: true, 
      trialEndsAt: trialEndsAt.toISOString(),
      message: 'Trial period set up successfully' 
    });
  } catch (error) {
    console.error('Error setting up trial:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}