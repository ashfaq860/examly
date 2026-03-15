// lib/admin-auth.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { redirect } from 'next/navigation'

/**
 * Checks if the current user has admin access
 * @param router Next.js router object for client-side redirects
 * @returns Promise<boolean> True if user is admin, false otherwise
 */
export const checkAdminAccess = async (router?: any): Promise<boolean> => {
  try {
    const supabase = createClientComponentClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      if (router) {
        router.push('/auth/login')
      }
      return false
    }

    const { data: roleData, error: rpcError } = await supabase
      .rpc('get_user_role', { user_id: user.id })
    
    if (rpcError) {
      console.error('Error fetching user role:', rpcError)
      return false
    }

    if (roleData !== "admin") {
      if (router) {
        router.push('/unauthorized')
      }
      return false
    }

    return true
  } catch (error) {
    console.error('Error checking admin access:', error)
    return false
  }
}

/**
 * Gets the current user's role
 * @returns Promise<string | null> User role or null if not authenticated
 */
export const getUserRole = async (): Promise<string | null> => {
  try {
    const supabase = createClientComponentClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return null
    }

    const { data: roleData, error: rpcError } = await supabase
      .rpc('get_user_role', { user_id: user.id })
    
    if (rpcError) {
      console.error('Error fetching user role:', rpcError)
      return null
    }

    return roleData
  } catch (error) {
    console.error('Error getting user role:', error)
    return null
  }
}

/**
 * Server-side admin check for API routes or server components
 */
export const checkAdminAccessServer = async (cookies: any): Promise<boolean> => {
  try {
    const { createServerComponentClient } = await import('@supabase/auth-helpers-nextjs')
    const supabase = createServerComponentClient({ cookies })
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return false
    }

    const { data: roleData, error: rpcError } = await supabase
      .rpc('get_user_role', { user_id: user.id })
    
    if (rpcError) {
      console.error('Error fetching user role:', rpcError)
      return false
    }

    return roleData === "admin"
  } catch (error) {
    console.error('Error checking admin access (server):', error)
    return false
  }
}