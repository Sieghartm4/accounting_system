import { useState, useEffect, useCallback, useRef } from 'react'

const useCollections = () => {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const collectionsRef = useRef([])

  const LIMIT = 50

  const prependCollection = useCallback((collection) => {
    if (!collection || !collection.id) return

    setCollections((prev) => {
      if (prev.some((row) => row.id === collection.id)) {
        return prev
      }
      const next = [collection, ...prev]
      collectionsRef.current = next
      return next
    })
  }, [])

  const fetchCollections = useCallback(async (offset = 0, append = false) => {
    if (!append) {
      setLoading(true)
      setError(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('No authorization token found')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/collections?offset=${offset}&limit=${LIMIT}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const result = await response.json()

      if (!result.success)
        throw new Error(result.message || 'Failed to fetch collections')

      const data = Array.isArray(result.data) ? result.data : []

      if (append) {
        const next = [...(collectionsRef.current || []), ...data]
        collectionsRef.current = next
        setCollections(next)
      } else {
        collectionsRef.current = data
        setCollections(data)
      }

      setHasMore(Boolean(result.hasMore))
    } catch (err) {
      setError(err.message || 'Failed to fetch collections')
      if (!append) setCollections([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchCollections(0, false)
  }, [fetchCollections])

  const loadMore = async () =>
    fetchCollections(collectionsRef.current.length || 0, true)

  return {
    collections,
    loading,
    loadingMore,
    hasMore,
    error,
    refetchCollections: fetchCollections,
    loadMore,
    prependCollection,
  }
}

export default useCollections
