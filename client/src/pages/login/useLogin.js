import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const useLogin = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const login = async (credentials) => {
    try {
      setLoading(true)
      setError(null)

      const subscriptionUrl =
        import.meta.env.VITE_SUBSCRIPTION_LINK ||
        `http://${import.meta.env.VITE_SUBSCRIPTION_URL || 'localhost'}:${import.meta.env.VITE_SUBSCRIPTION_PORT || '5051'}`

      const response = await fetch(`${subscriptionUrl}/credentials/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        credentials: 'include', // ✅ Include cookies (httpOnly token will be set by server)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Handle user without subscription - redirect to plan selection
        if (response.status === 403 && errorData.requiresSubscription) {
          // ✅ DO NOT store password - only temporarily in sessionStorage for plan selection
          sessionStorage.setItem(
            'pendingUser',
            JSON.stringify({
              username: credentials.username,
              // ❌ DO NOT store password
            }),
          )
          navigate('/register?step=plan')
          return
        }

        const errorMessage =
          errorData.message || `HTTP error! status: ${response.status}`
        throw new Error(errorMessage)
      }

      const result = await response.json()

      if (result.success) {
        // Keep only a non-secret marker for legacy pages; authentication uses
        // the httpOnly Mongo-backed Express session cookie.
        sessionStorage.setItem('authenticated', 'session')
        const { token: _, ...sessionUser } = result.data
        sessionStorage.setItem('auth_user', JSON.stringify(sessionUser))
        sessionStorage.setItem('user_username', result.data.username)
        sessionStorage.setItem('user_tenantDb', result.data.tenantDb)

        // Redirect ADMIN users to subscription admin page on subscription server
        if (result.data.role === 'ADMIN') {
          const subscriptionUrl =
            import.meta.env.VITE_SUBSCRIPTION_LINK ||
            `http://${import.meta.env.VITE_SUBSCRIPTION_URL || 'localhost'}:${import.meta.env.VITE_SUBSCRIPTION_PORT || '5051'}`
          // ✅ DO NOT pass token or user data via URL
          window.location.href = `${subscriptionUrl}/admin`
        } else {
          navigate('/dashboard')
        }
      } else {
        setError(result.message || 'Login failed')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, login }
}

export default useLogin
