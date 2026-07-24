-- DOWN: recreates the four orphaned functions dropped by
-- 20260724000002_drop_orphaned_trigger_functions.sql, verbatim as they
-- existed in production, WITHOUT attaching any trigger to them (they had
-- none before being dropped either — restoring them dormant matches the
-- state this migration found them in).
CREATE OR REPLACE FUNCTION public.give_trial_on_profile_completion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.cellno IS NOT NULL AND OLD.trial_given = false THEN
    UPDATE public.profiles
    SET
      trial_ends_at = NOW() + INTERVAL '1 year',
      subscription_status = 'active',
      trial_given = true
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_default_trial()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Set trial_ends_at to 30 days from now for new users
  NEW.trial_ends_at = CASE
    WHEN NEW.trial_given = FALSE THEN CURRENT_DATE + INTERVAL '30 days'
    ELSE NEW.trial_ends_at
  END;

  -- Set default subscription status
  NEW.subscription_status = 'inactive';
  NEW.login_method = 'email';

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reward_referrer_on_cellno()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  referrer_id_var uuid;
  referral_record RECORD;
BEGIN
  -- Check if this user was referred and hasn't been rewarded yet
  SELECT r.referrer_id, r.reward_given INTO referral_record
  FROM referrals r
  WHERE r.referred_user_id = NEW.id
    AND r.reward_given = FALSE
  LIMIT 1;

  -- If found unrewarded referral and user just added cellno
  IF referral_record.referrer_id IS NOT NULL AND
     NEW.cellno IS NOT NULL AND
     OLD.cellno IS NULL THEN

    -- Give 30 days extra trial to referrer
    UPDATE profiles
    SET trial_ends_at = COALESCE(trial_ends_at, CURRENT_DATE) + INTERVAL '30 days',
        subscription_status = 'active'
    WHERE id = referral_record.referrer_id;

    -- Mark referral as rewarded
    UPDATE referrals
    SET reward_given = TRUE,
        rewarded_at = CURRENT_TIMESTAMP
    WHERE referred_user_id = NEW.id
      AND referrer_id = referral_record.referrer_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.deduct_paper()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.user_packages
  SET papers_remaining = papers_remaining - 1
  WHERE user_id = NEW.created_by AND papers_remaining > 0;

  RETURN NEW;
END;
$function$;
