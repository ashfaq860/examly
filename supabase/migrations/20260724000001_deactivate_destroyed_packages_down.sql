-- DOWN: re-activates the 7 packages this migration deactivated. Does not
-- restore their real names — that data is still lost and must come from
-- the team, not this rollback.
update public.packages
set is_active = true
where name = 'DESTROYED';
