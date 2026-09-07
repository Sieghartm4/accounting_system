import React, { createContext, useState, useEffect, useCallback } from 'react'

export const SecureAuthContext = createContext()

export function SecureAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [csrfToken, setCsrfToken] = useState(null)

  // Load user from session on app mount (token is in httpOnly cookie, not localStorage)
  useEffect(() => {
    const loadUserSession = async () => {
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include', // ✅ Include cookies from httpOnly
        })
        if (response.ok) {
          const data = await response.json()
          setUser(data.data)
          setCsrfToken(data.csrfToken)
        } else if (response.status === 401) {
          // Session expired or invalid
          setUser(null)
          localStorage.removeItem('token') // Clear old tokens
          sessionStorage.removeItem('user_username')
        }
      } catch (error) {
        console.error('Session load error:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserSession()
  }, [])

  // Auto-refresh token before expiry (every 19 minutes for 24h tokens)
  useEffect(() => {
    if (!user) return

    const refreshInterval = setInterval(
      async () => {
        try {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          })
          if (!response.ok) {
            // Token refresh failed, redirect to login
            console.warn('Token refresh failed, logging out')
            logout()
          }
        } catch (error) {
          console.error('Token refresh error:', error)
        }
      },
      19 * 60 * 1000,
    ) // 19 minutes for 24h expiry

    return () => clearInterval(refreshInterval)
  }, [user])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/credentials/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      setCsrfToken(null)
      // ✅ Clear old localStorage/sessionStorage with sensitive data
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('rememberedUser')
      localStorage.removeItem('rememberedPassword')
      sessionStorage.clear()
    }
  }, [csrfToken])

  const value = {
    user,
    isLoading,
    csrfToken,
    logout,
    isAuthenticated: !!user,
  }

  return (
    <SecureAuthContext.Provider value={value}>{children}</SecureAuthContext.Provider>
  )
}

export function useSecureAuth() {
  const context = React.useContext(SecureAuthContext)
  if (!context) {
    throw new Error('useSecureAuth must be used within SecureAuthProvider')
  }
  return context
}
