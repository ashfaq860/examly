// src/lib/auth-utils.ts
import { createSupabaseBrowserClient } from './supabase/client'
import { getCurrentSession } from './session'

// Get the current session token securely
export const getSessionToken = async (): Promise<string> => {
  const user = await getCurrentSession()
  if (!user) {
    throw new Error('No active session. Please log in.')
  }

  // Fetch fresh access token (secure)
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) {
    throw new Error('Authentication required. Please log in.')
  }

  return data.session.access_token
}

// Check if user is admin using RPC
export const isUserAdmin = async (): Promise<boolean> => {
  const user = await getCurrentSession()
  if (!user) return false

  const supabase = createSupabaseBrowserClient()
  const { data: roleData, error } = await supabase
    .rpc('get_user_role')

  if (error) {
    console.error('RPC error:', error)
    return false
  }

  return roleData === 'admin'
}
