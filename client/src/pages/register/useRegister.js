import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const useRegister = () => {
  const [registerData, setRegisterData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState({ step: '', message: '', progress: 0 })
  const progressIntervalRef = useRef(null)
  const navigate = useNavigate()

  const register = async (userData) => {
    try {
      setLoading(true)
      setError(null)
      setProgress({ step: 'starting', message: 'Starting registration...', progress: 0 })

      const subscriptionUrl = `${import.meta.env.VITE_SUBSCRIPTION_LINK}`

      const response = await fetch(`${subscriptionUrl}/credentials/register-progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: userData.username,
          password: userData.password,
          db_name: userData.company_name,
          email: userData.email,
          subscription_id: userData.subscription_id || null,
          subscription_price: userData.subscription_price || null,
          subscription_billing_cycle: userData.subscription_billing_cycle || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage =
          errorData.message || `HTTP error! status: ${response.status}`
        throw new Error(errorMessage)
      }

      // Handle SSE stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      // Track current phase for simulated progress
      let currentPhase = 'migrations' // 'migrations' or 'seeders'
      let simulatedProgress = 30
      
      progressIntervalRef.current = setInterval(() => {
        if (simulatedProgress < 90) {
          simulatedProgress += 1
          
          // Determine message based on current phase and progress
          let message = 'Running migrations (this may take a while)...'
          if (simulatedProgress >= 70) {
            currentPhase = 'seeders'
            message = 'Running seeders (this may take a while)...'
          } else if (simulatedProgress >= 90) {
            message = 'Finalizing setup...'
          } else if (simulatedProgress < 30) {
            message = 'Creating database...'
          }
          
          setProgress(prev => ({
            ...prev,
            progress: simulatedProgress,
            message: message
          }))
        }
      }, 500)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            
            // Update simulated progress and phase based on actual server progress
            if (data.progress > 0) {
              simulatedProgress = data.progress
              if (data.step === 'running_seeders') {
                currentPhase = 'seeders'
              } else if (data.step === 'running_migrations') {
                currentPhase = 'migrations'
              }
            }
            
            setProgress(data)

            if (data.step === 'error') {
              clearInterval(progressIntervalRef.current)
              setError(data.message)
              setLoading(false)
              return false
            }

            if (data.step === 'complete' && data.success) {
              clearInterval(progressIntervalRef.current)
              setRegisterData(data)
              console.log('Registration successful:', data.message)
              // Store credentials for payment flow
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('registeredUsername', userData.username);
              }
              setLoading(false)
              return true
            }
          }
        }
      }
    } catch (err) {
      console.error('Network error:', err)
      clearInterval(progressIntervalRef.current)
      setError(err.message)
      setLoading(false)
      return false
    }
  }

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  return { registerData, loading, error, register, progress }
}

export default useRegister
