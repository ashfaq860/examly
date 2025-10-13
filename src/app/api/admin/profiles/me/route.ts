import { NextApiRequest, NextApiResponse } from 'next'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { UpdateProfileData } from '@/types/profile'
 const supabase = createClientComponentClient();
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get user ID from Supabase auth
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.substring(7)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    // Get current user's profile
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      res.status(200).json(profile)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  } else if (req.method === 'PUT') {
    // Update current user's profile
    try {
      const updateData: UpdateProfileData = req.body

      const { data: profile, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      res.status(200).json(profile)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}