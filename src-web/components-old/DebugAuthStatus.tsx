'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { isUserAdmin } from '@/lib/auth-utils'

export const DebugAuthStatus: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<any>(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const admin = await isUserAdmin()
        
        setAuthStatus({
          hasSession: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          isAdmin: admin,
          token: session ? `${session.access_token.substring(0, 20)}...` : 'None'
        })
      } catch (error) {
        setAuthStatus({ error: error.message })
      }
    }

    checkStatus()
  }, [])

  return (
    <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
      <h3 className="font-bold mb-2">Auth Debug</h3>
      <pre className="text-sm">
        {JSON.stringify(authStatus, null, 2)}
      </pre>
    </div>
  )
}