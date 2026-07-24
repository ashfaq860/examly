-- Deactivates the 7 `packages` rows whose `name` was overwritten to
-- "DESTROYED" during the breach (the packages table was targeted directly
-- by the compromised accounts). Deactivating (not deleting) keeps existing
-- user_packages foreign keys and historical reporting intact while
-- immediately stopping these rows from being offered/displayed — real
-- names/pricing need to be restored by the team separately.
-- The "Free Trial" package (unaffected, name intact) is untouched.
update public.packages
set is_active = false
where name = 'DESTROYED';
