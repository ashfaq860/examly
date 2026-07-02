-- Create the get_user_role RPC function
-- This function returns the role of a user from the profiles table
--
-- SECURITY: this is SECURITY DEFINER, so it bypasses RLS. Every call site
-- in the app only ever passes the CALLER's own auth.uid() — never a
-- third-party id — so the function itself now enforces that: it refuses
-- to return another user's role unless the caller is already an admin.
-- Without this check, anyone holding the public anon key could call this
-- RPC directly via PostgREST with an arbitrary user_id and enumerate
-- other users' roles (e.g. to find admin accounts to target).
-- Re-run this against the live database to apply the fix.

CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
    caller_role TEXT;
BEGIN
    IF user_id <> auth.uid() THEN
        SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
        IF caller_role IS DISTINCT FROM 'admin' AND caller_role IS DISTINCT FROM 'super_admin' THEN
            RETURN NULL;
        END IF;
    END IF;

    -- Get the role from profiles table
    SELECT role INTO user_role
    FROM profiles
    WHERE id = user_id;

    -- Return the role, or null if not found
    RETURN user_role;
END;
$$;