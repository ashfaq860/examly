-- Create the get_user_role RPC function
-- This function returns the role of a user from the profiles table

CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Get the role from profiles table
    SELECT role INTO user_role
    FROM profiles
    WHERE id = user_id;

    -- Return the role, or null if not found
    RETURN user_role;
END;
$$;