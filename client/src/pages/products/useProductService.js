import { useState, useEffect, useMemo } from 'react'
import { API } from '../../api/endpoints'
import { objectsToCsv, downloadCsv, parseCsv } from '../../utils/csv'

const EMPTY_FORM = {
  code: '',
  name: '',
  type: '',
  category: '',
  sales_price: '',
  purchase_price: '',
  unit: '',
}

const useProductService = () => {
  const [productService, setProductService] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProductService, setEditingProductService] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [toast, setToast] = useState(null)
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [syncPreviewItems, setSyncPreviewItems] = useState([])
  const [syncCategories, setSyncCategories] = useState([])
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState(new Set())
  const [selectedSyncItems, setSelectedSyncItems] = useState(new Set())
  const [syncSearchTerm, setSyncSearchTerm] = useState('')
  const [syncPreviewLoading, setSyncPreviewLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  const showToast = (type, message) => setToast({ type, message })

  const fetchProductService = async () => {
    try {
      setLoading(true)
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }
      const response = await fetch(
        API.productService(),
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
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.productService(),
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
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.productServiceSync(),
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
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.productServiceById(id),
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
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.productServiceSyncPreview(),
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
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.productServiceSyncImport(),
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

  // Inventory-sync preview wiring.
  const loadSyncPreview = async () => {
    try {
      setSyncPreviewLoading(true)
      const result = await previewProductServiceSync()
      if (result.success) {
        setSyncPreviewItems(result.data || [])
        setSyncCategories(result.categories || [])
        setSelectedCategoryKeys(new Set())
        setSelectedSyncItems(new Set())
        setSyncSearchTerm('')
        setSyncModalOpen(true)
      } else {
        showToast('error', result.message || 'Failed to load inventory preview')
      }
    } catch (err) {
      showToast('error', err.message || 'Failed to load inventory preview')
    } finally {
      setSyncPreviewLoading(false)
    }
  }

  const closeSyncModal = () => setSyncModalOpen(false)

  const handleSyncImport = async () => {
    const selected = syncPreviewItems.filter((item) =>
      selectedSyncItems.has(String(item.code)),
    )
    if (selected.length === 0) {
      showToast('error', 'Select at least one item to import')
      return
    }

    const result = await importProductService(selected)
    if (result.success) {
      showToast(
        'success',
        result.message || 'Selected inventory items imported successfully',
      )
      setSyncModalOpen(false)
      setSelectedSyncItems(new Set())
      setSelectedCategoryKeys(new Set())
      setSyncPreviewItems([])
    } else {
      showToast('error', result.message || 'Failed to import selected items')
    }
  }

  // Sync-preview filtering and selection.
  const filteredSyncPreviewItems = useMemo(() => {
    const term = syncSearchTerm.trim().toLowerCase()
    return syncPreviewItems.filter((item) => {
      if (!term) return true
      return [item.code, item.name, item.category, item.sourceCompanyName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [syncPreviewItems, syncSearchTerm])

  const visibleSyncItems = useMemo(
    () =>
      filteredSyncPreviewItems.filter(
        (item) =>
          selectedCategoryKeys.size === 0 ||
          selectedCategoryKeys.has(item.category),
      ),
    [filteredSyncPreviewItems, selectedCategoryKeys],
  )

  const allVisibleSyncKeys = useMemo(
    () => visibleSyncItems.map((item) => String(item.code)),
    [visibleSyncItems],
  )

  const allSyncChecked =
    allVisibleSyncKeys.length > 0 &&
    allVisibleSyncKeys.every((key) => selectedSyncItems.has(key))

  const someSyncChecked = allVisibleSyncKeys.some((key) =>
    selectedSyncItems.has(key),
  )

  const handleToggleAllVisibleRows = () => {
    setSelectedSyncItems((prev) => {
      const next = new Set(prev)
      if (allSyncChecked) {
        allVisibleSyncKeys.forEach((key) => next.delete(key))
      } else {
        allVisibleSyncKeys.forEach((key) => next.add(key))
      }
      return next
    })
  }

  const isCategorySelected = (category) => selectedCategoryKeys.has(category)

  const toggleCategorySelection = (category) => {
    const nextCategories = new Set(selectedCategoryKeys)
    const shouldSelect = !nextCategories.has(category)
    if (shouldSelect) {
      nextCategories.add(category)
    } else {
      nextCategories.delete(category)
    }
    setSelectedCategoryKeys(nextCategories)

    setSelectedSyncItems((prev) => {
      const nextSelected = new Set(prev)
      syncPreviewItems.forEach((item) => {
        if (item.category === category) {
          const key = String(item.code)
          if (shouldSelect) {
            nextSelected.add(key)
          } else {
            nextSelected.delete(key)
          }
        }
      })
      return nextSelected
    })
  }

  const togglePreviewRow = (item) => {
    const key = String(item.code)
    setSelectedSyncItems((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const setSyncSearch = (value) => setSyncSearchTerm(value)

  // Catalog CSV import (mirrors the withholding tax import flow).
  const importProductServiceCatalog = async (products) => {
    try {
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.productServiceImport(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ products }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      if (result.success) {
        await fetchProductService()
        return { success: true, data: result.data, message: result.message }
      }

      return {
        success: false,
        message: result.message || 'Failed to import products/services',
      }
    } catch (err) {
      console.error('Error importing products/services:', err.message)
      return { success: false, message: err.message }
    }
  }

  const handleImportCatalog = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showToast('error', 'Please select a CSV file')
      e.target.value = ''
      return
    }

    setImporting(true)
    try {
      const text = await file.text()
      const rows = parseCsv(text)

      const products = rows.map((row) => ({
        code: row.code,
        name: row.name,
        type: row.type,
        category: row.category,
        sales_price: row.sales_price,
        purchase_price: row.purchase_price,
        unit: row.unit,
      }))

      const importable = products.filter((p) => p.code || p.name || p.type)
      if (importable.length === 0) {
        showToast('error', 'No valid product/service entries found in CSV')
        return
      }

      const result = await importProductServiceCatalog(importable)

      if (result.success) {
        const { created, updated, errors } = result.data
        showToast(
          'success',
          `Import completed: ${created.length} created, ${updated.length} updated${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
        )
      } else {
        showToast('error', result.message || 'Failed to import products/services')
      }
    } catch (err) {
      console.error('Import error:', err)
      showToast('error', 'Failed to read CSV file')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  // Modal + form wiring.
  const openModal = (productData = null) => {
    if (productData) {
      setEditingProductService(productData)
      setFormData({
        code: productData.code || '',
        name: productData.name || '',
        type: productData.type ? String(productData.type).toLowerCase() : '',
        category: productData.category || '',
        sales_price:
          productData.sales_price !== undefined && productData.sales_price !== null
            ? productData.sales_price
            : '',
        purchase_price:
          productData.purchase_price !== undefined &&
          productData.purchase_price !== null
            ? productData.purchase_price
            : '',
        unit: productData.unit || '',
      })
    } else {
      setEditingProductService(null)
      setFormData(EMPTY_FORM)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingProductService(null)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Catalog export.
  const exportCatalog = () => {
    try {
      if (!Array.isArray(productService) || productService.length === 0) {
        showToast('error', 'No products/services to export')
        return
      }

      const csvContent = objectsToCsv(productService)
      downloadCsv(csvContent, `product_catalog_${Date.now()}.csv`)
      showToast('success', 'Export started')
    } catch {
      showToast('error', 'Failed to export CSV')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const result = editingProductService
        ? await updateProductService(
            editingProductService.id,
            formData.code,
            formData.name,
            formData.type,
            formData.category,
            formData.sales_price,
            formData.purchase_price,
            formData.unit,
          )
        : await createProductService(
            formData.code,
            formData.name,
            formData.type,
            formData.category,
            formData.sales_price,
            formData.purchase_price,
            formData.unit,
          )

      if (result.success) {
        showToast(
          'success',
          `Product/Service "${formData.name}" ${editingProductService ? 'updated' : 'created'} successfully!`,
        )
        closeModal()
      } else {
        showToast(
          'error',
          result.message ||
            `Failed to ${editingProductService ? 'update' : 'create'} product/service`,
        )
      }
    } catch {
      showToast(
        'error',
        `Network error occurred while ${editingProductService ? 'updating' : 'creating'} product/service`,
      )
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
    isModalOpen,
    editingProductService,
    formData,
    toast,
    openModal,
    closeModal,
    handleInputChange,
    exportCatalog,
    handleImportCatalog,
    importing,
    handleSubmit,
    closeToast: () => setToast(null),
    syncModalOpen,
    syncPreviewItems,
    syncCategories,
    selectedCategoryKeys,
    selectedSyncItems,
    syncSearchTerm,
    syncPreviewLoading,
    filteredSyncPreviewItems,
    allSyncChecked,
    someSyncChecked,
    loadSyncPreview,
    closeSyncModal,
    setSyncSearch,
    toggleCategorySelection,
    togglePreviewRow,
    isCategorySelected,
    handleToggleAllVisibleRows,
    handleSyncImport,
  }
}

export default useProductService
