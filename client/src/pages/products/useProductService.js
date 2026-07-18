import { useState, useEffect } from 'react'

const useProductService = () => {
  const [productService, setProductService] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProductService = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/product_service`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setProductService(result.data)
      } else {
        setError(result.message || 'Failed to fetch product service')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProductService()
  }, [])

  const createProductService = async (
    code,
    name,
    type,
    category,
    sales_price,
    purchase_price,
    unit,
  ) => {
    try {
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/product_service`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            code,
            name,
            type,
            category,
            sales_price,
            purchase_price,
            unit,
          }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        // Refresh the product service list
        await fetchProductService()
        return { success: true, data: result.data }
      } else {
        return {
          success: false,
          message: result.message || 'Failed to create product/service',
        }
      }
    } catch (err) {
      console.error('Error creating product/service:', err.message)
      return { success: false, message: err.message }
    }
  }

  const syncProductService = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/product_service/sync`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      return result.success
        ? { success: true, data: result.data, message: result.message }
        : {
            success: false,
            message: result.message || 'Failed to sync product/service',
          }
    } catch (err) {
      console.error('Error syncing product/service:', err.message)
      return { success: false, message: err.message }
    }
  }

  const updateProductService = async (
    id,
    code,
    name,
    type,
    category,
    sales_price,
    purchase_price,
    unit,
  ) => {
    try {
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/product_service/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id,
            code,
            name,
            type,
            category,
            sales_price,
            purchase_price,
            unit,
          }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        await fetchProductService()
        return { success: true, data: result.data }
      }

      return {
        success: false,
        message: result.message || 'Failed to update product/service',
      }
    } catch (err) {
      console.error('Error updating product/service:', err.message)
      return { success: false, message: err.message }
    }
  }

  const previewProductServiceSync = async () => {
    try {
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/product_service/sync/preview`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        return {
          success: true,
          data: result.data,
          categories: result.categories,
          message: result.message,
        }
      }

      return {
        success: false,
        message: result.message || 'Failed to preview sync product/service',
      }
    } catch (err) {
      console.error('Error previewing product/service sync:', err.message)
      return { success: false, message: err.message }
    }
  }

  const importProductService = async (items) => {
    try {
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/product_service/sync/import`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ items }),
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        await fetchProductService()
        return { success: true, data: result.data, message: result.message }
      }

      return {
        success: false,
        message: result.message || 'Failed to import selected product/service items',
      }
    } catch (err) {
      console.error('Error importing selected product/service items:', err.message)
      return { success: false, message: err.message }
    }
  }

  return {
    productService,
    loading,
    error,
    createProductService,
    updateProductService,
    syncProductService,
    previewProductServiceSync,
    importProductService,
  }
}

export default useProductService
