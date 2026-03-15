// lib/trialUtils.ts
export const calculateTrialStatus = (userCreatedAt: string, papersGenerated: number = 0) => {
  const signupDate = new Date(userCreatedAt);
  const now = new Date();
  const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const isTrial = daysSinceSignup <= 7;
  const trialDaysLeft = isTrial ? Math.max(0, 7 - daysSinceSignup) : 0;
  const papersLeft = isTrial ? Math.max(0, 5 - papersGenerated) : 0;

  return { isTrial, trialDaysLeft, papersLeft };
};