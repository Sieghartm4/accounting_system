import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { API } from '../../api/endpoints'

export const fmt = (value) =>
  new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)

export const emptyPurchaseOrderRow = {
  product: '',
  quantity: '',
  price: '',
  procurement_id: '',
  responsibility_center: '',
}

const usePurchaseOrder = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Page state.
  const navigate = useNavigate()
  const [toastMessage, setToastMessage] = useState(null)
  const [toastType, setToastType] = useState('info')
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [itemFormRows, setItemFormRows] = useState([{ ...emptyPurchaseOrderRow }])
  const [isSaving, setIsSaving] = useState(false)
  const [modalError, setModalError] = useState(null)
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)
  const [approvalTargetRows, setApprovalTargetRows] = useState([])
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [approvalError, setApprovalError] = useState(null)
  const [activeFilter, setActiveFilter] = useState(null)

  const fetchPurchaseOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(
        API.purchaseOrder(),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setPurchaseOrders(result.data || [])
      } else {
        setError(result.message || 'Failed to fetch purchase orders')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const updatePurchaseOrderStatus = useCallback(
    async (poId, updates) => {
      try {
        const token = sessionStorage.getItem('authenticated')

        if (!token) {
          throw new Error('No authorization token found')
        }

        const response = await fetch(
          API.purchaseOrderById(poId),
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          },
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        if (result.success) {
          await fetchPurchaseOrders()
          return result
        } else {
          throw new Error(result.message || 'Failed to update purchase order')
        }
      } catch (err) {
        setError(err.message)
        throw err
      }
    },
    [fetchPurchaseOrders],
  )

  const createPurchaseOrder = useCallback(
    async (payload) => {
      try {
        const token = sessionStorage.getItem('authenticated')

        if (!token) {
          throw new Error('No authorization token found')
        }

        const response = await fetch(
          API.purchaseOrder(),
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          },
        )

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP error! status: ${response.status} ${errorText}`)
        }

        const result = await response.json()

        if (result.success) {
          await fetchPurchaseOrders()
          return result
        }

        throw new Error(result.message || 'Failed to create purchase order')
      } catch (err) {
        setError(err.message)
        throw err
      }
    },
    [fetchPurchaseOrders],
  )

  useEffect(() => {
    fetchPurchaseOrders()
  }, [fetchPurchaseOrders])

  // ── Item modal wiring ──
  const resetItemForm = () => {
    setItemFormRows([{ ...emptyPurchaseOrderRow }])
    setModalError(null)
  }

  const handleCreateNew = () => {
    resetItemForm()
    setEditingItem(null)
    setShowItemModal(true)
  }

  const handleModalClose = () => {
    if (isSaving) return
    setShowItemModal(false)
    setEditingItem(null)
    resetItemForm()
  }

  const updateItemFormRow = (index, field, value) => {
    setItemFormRows((prevRows) =>
      prevRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    )
  }

  const addItemFormRow = () => {
    setItemFormRows((prevRows) => [...prevRows, { ...emptyPurchaseOrderRow }])
  }

  const removeItemFormRow = (index) => {
    setItemFormRows((prevRows) =>
      prevRows.filter((_, rowIndex) => rowIndex !== index),
    )
  }

  const handleSavePurchaseOrders = async () => {
    try {
      setModalError(null)
      setIsSaving(true)

      const payload = itemFormRows.map((row) => ({
        product: row.product?.trim(),
        quantity: Number(row.quantity),
        price: Number(row.price),
        procurement_id: row.procurement_id?.trim() || null,
        responsibility_center: row.responsibility_center?.trim() || null,
        status: 'PENDING',
      }))

      const invalidRowIndex = itemFormRows.findIndex((row) => {
        const hasProduct = row.product?.trim()
        const quantityValue = row.quantity
        const priceValue = row.price
        return (
          !hasProduct ||
          quantityValue === '' ||
          priceValue === '' ||
          Number.isNaN(Number(quantityValue)) ||
          Number.isNaN(Number(priceValue))
        )
      })

      if (invalidRowIndex !== -1) {
        throw new Error(
          `Row ${invalidRowIndex + 1} needs a product, quantity, and price.`,
        )
      }

      await createPurchaseOrder(payload)
      setToastMessage(`${payload.length} purchase order(s) created successfully`)
      setToastType('success')
      setShowItemModal(false)
      resetItemForm()
      await fetchPurchaseOrders()
    } catch (err) {
      setModalError(err.message || 'Failed to create purchase orders')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Approval flow (approve + redirect to disbursement/purchase) ──
  const buildPurchaseFormPrefill = (rows) => ({
    items: rows.map((row) => {
      const productValue = row.product
      const parsedProductId =
        typeof productValue === 'number' ||
        (typeof productValue === 'string' &&
          String(productValue).trim() !== '' &&
          /^\d+$/.test(productValue))
          ? Number(productValue)
          : null
      const productLabel =
        parsedProductId === null && productValue != null
          ? String(productValue).trim()
          : ''

      return {
        id: Date.now() + Math.random(),
        product_service_id: parsedProductId,
        product_service_name: productLabel,
        coa: '',
        coaSearch: '',
        description: productLabel || '',
        qty: Number(row.quantity) || 0,
        price: Number(row.price) || 0,
        purchase_price: Number(row.price) || 0,
        discount: 0,
        discountType: 'PERCENT',
        // Provide VAT fields using the same keys PurchaseForm expects so
        // the Purchase form populates the visible label immediately.
        vat: 0,
        vat_id: 0,
        vat_code: 'No VAT',
        vat_name: 'No VAT%',
        vat_rate: 0,
        vatSearch: 'No VAT - No VAT%',
        vatRate: 0,
        // Withholding tax defaults (include both correct and misspelled keys)
        wht: 0,
        withholding_tax_id: 0,
        withholding_tax_code: 'NON-WHT',
        withholding_tax_name: 'NON-WHT',
        withholding_tax_rate: 0,
        // Some existing code uses a misspelled key `witholding_tax_*`, include it too
        witholding_tax_id: 0,
        witholding_tax: 0,
        whtSearch: 'NON-WHT - NON-WHT',
        whtRate: 0,
        responsibilityCenter: row.responsibility_center || '',
        isOther: false,
        isNew: true,
      }
    }),
  })

  const buildDisbursementFormPrefill = (rows) => ({
    items: rows.map((row) => {
      const productValue = row.product
      const parsedProductId =
        typeof productValue === 'number' ||
        (typeof productValue === 'string' &&
          String(productValue).trim() !== '' &&
          /^\d+$/.test(productValue))
          ? Number(productValue)
          : null
      const productLabel =
        parsedProductId === null && productValue != null
          ? String(productValue).trim()
          : ''

      return {
        id: Date.now() + Math.random(),
        product_service_id: parsedProductId,
        product_service_name: productLabel,
        coa: '',
        coaSearch: '',
        description: productLabel || '',
        quantity: Number(row.quantity) || 0,
        purchase_price: Number(row.price) || 0,
        discount: 0,
        discount_type: 'PERCENT',
        vat_id: 0,
        vat_code: 'No VAT',
        vat_name: 'No VAT%',
        vat_rate: 0,
        withholding_tax_id: 0,
        withholding_tax_code: 'NON-WHT',
        withholding_tax_rate: 0,
        responsibility_center: row.responsibility_center || '',
        isOther: false,
      }
    }),
    doc_ref: '',
    mode: 'CASH',
    modeSearch: 'CASH',
    bank_name: '',
    check_number: '',
    payment_date: new Date().toISOString().slice(0, 10),
    remarks: '',
    vendor_id: null,
    vendor: '',
  })

  const handleApprovalModalClose = () => {
    if (approvalLoading) return
    setApprovalModalOpen(false)
    setApprovalTargetRows([])
    setApprovalError(null)
  }

  const handleBulkApprove = (selectedRows) => {
    // Approve any rows that are not already APPROVED (allow approving PENDING or REJECTED)
    const approvableRows = selectedRows.filter((row) => row.status !== 'APPROVED')

    if (approvableRows.length === 0) {
      setToastMessage('No purchase order(s) available to approve')
      setToastType('warning')
      return
    }

    setApprovalTargetRows(approvableRows)
    setApprovalModalOpen(true)
  }

  const handleApproveAndRedirect = async (paymentMethod) => {
    try {
      setApprovalLoading(true)
      setApprovalError(null)

      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authentication token found')

      const responses = await Promise.all(
        approvalTargetRows.map((row) =>
          fetch(API.purchaseOrderById(row.id), {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...row, status: 'APPROVED' }),
          }),
        ),
      )

      const failedResponse = responses.find((res) => !res.ok)
      if (failedResponse) {
        const errorText = await failedResponse.text()
        throw new Error(`Failed to approve purchase order(s): ${errorText}`)
      }

      setToastMessage(
        `${approvalTargetRows.length} purchase order(s) approved successfully`,
      )
      setToastType('success')
      await fetchPurchaseOrders()
      setApprovalModalOpen(false)

      const prefillData =
        paymentMethod === 'CASH'
          ? buildDisbursementFormPrefill(approvalTargetRows)
          : buildPurchaseFormPrefill(approvalTargetRows)

      if (paymentMethod === 'CASH') {
        navigate('/disbursement', {
          state: { prefillDisbursementData: prefillData },
        })
      } else {
        navigate('/purchase', { state: { prefillPurchaseData: prefillData } })
      }
    } catch (err) {
      const message = err.message || 'Failed to approve purchase orders'
      setApprovalError(message)
      setToastMessage(message)
      setToastType('error')
    } finally {
      setApprovalLoading(false)
    }
  }

  const handleBulkReject = async (selectedRows) => {
    try {
      // Reject any rows that are not already REJECTED (allow rejecting PENDING or APPROVED)
      const rejectableRows = selectedRows.filter((row) => row.status !== 'REJECTED')
      const updatePromises = rejectableRows.map((row) =>
        updatePurchaseOrderStatus(row.id, {
          ...row,
          status: 'REJECTED',
        }),
      )

      await Promise.all(updatePromises)
      setToastMessage(
        `${updatePromises.length} purchase order(s) rejected successfully`,
      )
      setToastType('warning')
      await fetchPurchaseOrders()
    } catch (err) {
      setToastMessage(err.message || 'Failed to reject purchase orders')
      setToastType('error')
    }
  }

  // Filter which checkbox actions to show based on selection statuses
  const checkboxActionsFilter = (selectedRows) => {
    if (!selectedRows || selectedRows.length === 0) return []

    const allApproved = selectedRows.every((r) => r.status === 'APPROVED')
    const allRejected = selectedRows.every((r) => r.status === 'REJECTED')

    if (allApproved) {
      return [
        {
          label: 'Reject Selected',
          onClick: handleBulkReject,
          className: 'bg-red-600 hover:bg-red-700',
        },
      ]
    }

    if (allRejected) {
      return [
        {
          label: 'Approve Selected',
          onClick: handleBulkApprove,
          className: 'bg-green-600 hover:bg-green-700',
        },
      ]
    }

    // Mixed or pending: show both actions
    return [
      {
        label: 'Approve Selected',
        onClick: handleBulkApprove,
        className: 'bg-green-600 hover:bg-green-700',
      },
      {
        label: 'Reject Selected',
        onClick: handleBulkReject,
        className: 'bg-red-600 hover:bg-red-700',
      },
    ]
  }

  // Filtering + totals.
  const filteredPurchaseOrders = useMemo(() => {
    if (!activeFilter) return purchaseOrders

    switch (activeFilter) {
      case 'PENDING':
        return purchaseOrders?.filter((po) => po.status === 'PENDING') || []
      case 'APPROVED':
        return purchaseOrders?.filter((po) => po.status === 'APPROVED') || []
      case 'REJECTED':
        return purchaseOrders?.filter((po) => po.status === 'REJECTED') || []
      default:
        return purchaseOrders
    }
  }, [purchaseOrders, activeFilter])

  const filteredTotalValue = useMemo(
    () =>
      filteredPurchaseOrders?.reduce(
        (sum, po) => sum + Number(po.price * po.quantity || 0),
        0,
      ) || 0,
    [filteredPurchaseOrders],
  )

  const tableData = useMemo(
    () =>
      filteredPurchaseOrders.map((po) => ({
        ...po,
        product: po.product_name || po.product,
        procurement_id: po.procurement_id || null,
        amount: `₱${fmt(po.price * po.quantity)}`,
        unit_price: `₱${fmt(po.price)}`,
      })),
    [filteredPurchaseOrders],
  )

  return {
    purchaseOrders,
    loading,
    error,
    refreshPurchaseOrders: fetchPurchaseOrders,
    updatePurchaseOrderStatus,
    createPurchaseOrder,
    toastMessage,
    toastType,
    closeToast: () => setToastMessage(null),
    showItemModal,
    editingItem,
    isSaving,
    modalError,
    itemFormRows,
    handleCreateNew,
    handleModalClose,
    handleSavePurchaseOrders,
    updateItemFormRow,
    addItemFormRow,
    removeItemFormRow,
    approvalModalOpen,
    approvalTargetRows,
    approvalLoading,
    approvalError,
    handleApprovalModalClose,
    handleBulkApprove,
    handleBulkReject,
    handleApproveAndRedirect,
    checkboxActionsFilter,
    activeFilter,
    setActiveFilter,
    filteredPurchaseOrders,
    filteredTotalValue,
    tableData,
  }
}

export default usePurchaseOrder
