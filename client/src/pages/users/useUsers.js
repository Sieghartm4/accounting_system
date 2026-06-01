import { useState, useEffect } from 'react'

const useUsers = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const handleUserRowClick = (username, userData) => {
    // console.log('Row clicked!');
    // console.log('Username:', username);
    // console.log('Full user data:', userData);
    // alert(`User clicked: ${username}`);
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(`${import.meta.env.VITE_SERVER_LINK}/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setUsers(result.data)
        setError(null)
      } else {
        setError(result.message || 'Failed to fetch users')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  return { users, loading, error, handleUserRowClick, fetchUsers }
}

export default useUsers
