import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const useLogin = () => {
  const [loginData, setLoginData] = useState(null)
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
        console.log('SUBSCRIPTION_URL:', subscriptionUrl)
      const response = await fetch(`${subscriptionUrl}/credentials/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        // Handle user without subscription - redirect to plan selection
        if (response.status === 403 && errorData.requiresSubscription) {
          // Store user credentials for plan selection
          sessionStorage.setItem('pendingUser', JSON.stringify({
            username: credentials.username,
            password: credentials.password
          }))
          navigate('/register?step=plan')
          return
        }
        
        const errorMessage =
          errorData.message || `HTTP error! status: ${response.status}`
        throw new Error(errorMessage)
      }

      const result = await response.json()

      if (result.success) {
        setLoginData(result.data)
        localStorage.setItem('token', result.data.token)
        localStorage.setItem('user', JSON.stringify(result.data))
        
        // Redirect ADMIN users to subscription admin page on subscription server
        if (result.data.role === 'ADMIN') {
          const subscriptionUrl =
            import.meta.env.VITE_SUBSCRIPTION_LINK ||
            `http://${import.meta.env.VITE_SUBSCRIPTION_URL || 'localhost'}:${import.meta.env.VITE_SUBSCRIPTION_PORT || '5051'}`;
          // Pass token and user data as URL parameters
          const userData = encodeURIComponent(JSON.stringify(result.data));
          window.location.href = `${subscriptionUrl}/admin?token=${result.data.token}&user=${userData}`;
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

  return { loginData, loading, error, login }
}

export default useLogin
