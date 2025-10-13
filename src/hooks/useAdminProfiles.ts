import { useState, useEffect } from 'react'
import { Profile, ProfileFilters, UpdateProfileData } from '../types/profile'
import { getSessionToken, isUserAdmin } from '../lib/auth-helpers'
import { useRouter } from 'next/navigation'

export const useAdminProfiles = (initialFilters?: ProfileFilters) => {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const fetchProfiles = async (filters: ProfileFilters = {}) => {
    try {
      setLoading(true)
      setError(null)
      
      // Get the authentication token
      let token: string
      try {
        token = await getSessionToken()
        setIsAuthenticated(true)
        
        // Check if user is admin
        const adminCheck = await isUserAdmin()
        setIsAdmin(adminCheck)
        
        if (!adminCheck) {
          setError('Admin access required.')
          setLoading(false)
          return
        }
      } catch (authError: any) {
        setIsAuthenticated(false)
        setIsAdmin(false)
        setError(authError.message)
        setLoading(false)
        return
      }
      
      const params = new URLSearchParams()
      if (filters.role) params.append('role', filters.role)
      if (filters.subscription_status) params.append('subscription_status', filters.subscription_status)
      if (filters.search) params.append('search', filters.search)
      if (filters.page) params.append('page', filters.page.toString())
      if (filters.limit) params.append('limit', filters.limit.toString())

      const response = await fetch(`/api/admin/profiles?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false)
          setIsAdmin(false)
          router.push('/auth/login')
          throw new Error('Authentication failed. Redirecting to login...')
        }
        if (response.status === 403) {
          throw new Error('Admin access required.')
        }
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to fetch profiles: ${response.status}`)
      }
      
      const data = await response.json()
      setProfiles(data.profiles)
      setPagination(data.pagination)
    } catch (err: any) {
      // Don't set error if it's an auth redirect
      if (!err.message.includes('Redirecting to login')) {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (id: string, data: UpdateProfileData): Promise<Profile> => {
    try {
      const token = await getSessionToken()
      
      const response = await fetch(`/api/admin/profiles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to update profile: ${response.status}`)
      }
      
      const updatedProfile = await response.json()
      setProfiles(prev => prev.map(p => p.id === id ? updatedProfile : p))
      return updatedProfile
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  const deleteProfile = async (id: string): Promise<void> => {
    try {
      const token = await getSessionToken()
      
      const response = await fetch(`/api/admin/profiles/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to delete profile: ${response.status}`)
      }
      
      setProfiles(prev => prev.filter(p => p.id !== id))
      setPagination(prev => ({ ...prev, total: prev.total - 1 }))
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  useEffect(() => {
    // Only fetch profiles if we're authenticated and admin
    const checkAndFetch = async () => {
      try {
        const token = await getSessionToken()
        if (token) {
          setIsAuthenticated(true)
          
          // Check if user is admin
          const adminCheck = await isUserAdmin()
          setIsAdmin(adminCheck)
          
          if (adminCheck) {
            fetchProfiles(initialFilters)
          } else {
            setError('Admin access required.')
            setLoading(false)
          }
        } else {
          setIsAuthenticated(false)
          setIsAdmin(false)
          setLoading(false)
        }
      } catch (error) {
        setIsAuthenticated(false)
        setIsAdmin(false)
        setLoading(false)
      }
    }

    checkAndFetch()
  }, [])

  return {
    profiles,
    loading,
    error,
    pagination,
    isAuthenticated,
    isAdmin,
    fetchProfiles,
    updateProfile,
    deleteProfile,
    refetch: () => fetchProfiles(initialFilters)
  }
}