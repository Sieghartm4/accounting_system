import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const useRegister = () => {
  const [registerData, setRegisterData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const register = async (userData) => {
    try {
      setLoading(true)
      setError(null)

      const subscriptionUrl = `${import.meta.env.VITE_SUBSCRIPTION_LINK}`

      const response = await fetch(`${subscriptionUrl}/credentials/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: userData.username,
          password: userData.password,
          db_name: userData.company_name,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage =
          errorData.message || `HTTP error! status: ${response.status}`
        throw new Error(errorMessage)
      }

      const result = await response.json()

      if (result.success) {
        setRegisterData(result.data)
        console.log('Registration successful:', result.message)
        navigate('/login')
      } else {
        console.error('Registration failed:', result.message)
        setError(result.message || 'Registration failed')
      }
    } catch (err) {
      console.error('Network error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { registerData, loading, error, register }
}

export default useRegister
