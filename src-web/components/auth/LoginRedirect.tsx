'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export const LoginRedirect: React.FC<{ message?: string }> = ({ 
  message = 'Authentication required. Redirecting to login...' 
}) => {
  const router = useRouter()

  useEffect(() => {
    const redirectToLogin = async () => {
      // Check if we have a session first
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/auth/login')
      } else {
        // If we have a session but still get auth errors, maybe token is expired
        await supabase.auth.signOut()
        router.push('/auth/login')
      }
    }

    redirectToLogin()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-lg text-gray-600 mb-4">{message}</div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    </div>
  )
}