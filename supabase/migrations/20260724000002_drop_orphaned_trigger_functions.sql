-- Drops four trigger functions confirmed (via information_schema.triggers)
-- to have no trigger attached anywhere in the database — earlier
-- iterations of trial-granting/referral-reward/paper-deduction logic that
-- were superseded by handle_mobile_verified_rewards() and the app-level
-- consumePaperGeneration()/increment-count flow, but never cleaned up.
-- Confirmed dormant, not just redundant: give_trial_on_profile_completion()
-- and set_default_trial() would each set a DIFFERENT trial_ends_at (1 year,
-- 30 days) than the 180 days handle_mobile_verified_rewards() actually
-- grants; reward_referrer_on_cellno() duplicates handle_mobile_verified_rewards()'s
-- referral-reward branch; deduct_paper() would double-charge alongside the
-- app's own papers_remaining decrement. Leaving them in place risked one
-- getting re-attached by accident later and silently reintroducing
-- conflicting trial/refund logic. Dropping the functions, not just leaving
-- them unattached, removes that risk entirely.
drop function if exists public.give_trial_on_profile_completion();
drop function if exists public.set_default_trial();
drop function if exists public.reward_referrer_on_cellno();
drop function if exists public.deduct_paper();
