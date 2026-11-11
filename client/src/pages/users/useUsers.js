import { useState, useEffect, useCallback } from 'react'
import { API } from '../../api/endpoints'

const EMPTY_CREATE_FORM = {
  fullname: '',
  username: '',
  password: '',
  email: '',
  access_id: '',
}

const EMPTY_EDIT_FORM = { access_id: '', status: '' }

const useUsers = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [accessOptions, setAccessOptions] = useState([])
  const [accessSearch, setAccessSearch] = useState('')
  const [selectedAccess, setSelectedAccess] = useState({ value: '', label: '' })
  const [formData, setFormData] = useState(EMPTY_CREATE_FORM)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [accessError, setAccessError] = useState('')

  const [showEditForm, setShowEditForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [editFormData, setEditFormData] = useState(EMPTY_EDIT_FORM)
  const [editAccessSearch, setEditAccessSearch] = useState('')
  const [selectedEditAccess, setSelectedEditAccess] = useState({
    value: '',
    label: '',
  })
  const [editFormError, setEditFormError] = useState('')
  const [editFormSuccess, setEditFormSuccess] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  const handleUserRowClick = () => {}

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const token = sessionStorage.getItem('authenticated')

      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(API.users(), {
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
  }, [])

  const fetchAccessOptions = async () => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) return

      const response = await fetch(API.access(), {
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
        setAccessOptions(
          result.data.map((item) => ({
            value: item.access_id,
            label: item.name || item.access_name,
          })),
        )
        setAccessError('')
      } else {
        setAccessError(result.message || 'Failed to load access roles')
      }
    } catch (err) {
      setAccessError(err.message)
    }
  }

  useEffect(() => {
    fetchAccessOptions()
  }, [])

  // Load the user list on mount. Without this the page showed the loading
  // screen forever because nothing ever fetched the users.
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const openCreateForm = () => {
    setFormError('')
    setFormSuccess('')
    setFormData(EMPTY_CREATE_FORM)
    setAccessSearch('')
    setSelectedAccess({ value: '', label: '' })
    setShowCreateForm(true)
  }

  const closeCreateForm = () => {
    setShowCreateForm(false)
    setFormError('')
  }

  const handleAccessSearchChange = (value) => {
    setAccessSearch(value)
    setSelectedAccess({ value: '', label: '' })
    setFormData({ ...formData, access_id: '' })
  }

  const handleAccessSelect = (option) => {
    setSelectedAccess(option)
    setAccessSearch(option.label)
    setFormData({ ...formData, access_id: option.value })
  }

  const handleCreateFormChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleEditFormChange = (e) => {
    const { name, value } = e.target
    setEditFormData((prev) => ({ ...prev, [name]: value }))
  }

  const findAccessOptionById = (accessId) =>
    accessOptions.find((option) => String(option.value) === String(accessId)) || {
      value: '',
      label: '',
    }

  const openEditForm = (user) => {
    const option = findAccessOptionById(user.access_id)

    setEditUser(user)
    setEditFormData({
      access_id: user.access_id || '',
      status: user.status || 'ACTIVE',
    })
    setEditAccessSearch(option.label || user.access_name || '')
    setSelectedEditAccess(
      option.value
        ? option
        : { value: user.access_id, label: user.access_name || '' },
    )
    setEditFormError('')
    setEditFormSuccess('')
    setShowEditForm(true)
  }

  const closeEditForm = () => {
    setShowEditForm(false)
    setEditFormError('')
    setEditFormSuccess('')
  }

  const handleEditAccessSearchChange = (value) => {
    setEditAccessSearch(value)
    setSelectedEditAccess({ value: '', label: '' })
    setEditFormData({ ...editFormData, access_id: '' })
  }

  const handleEditAccessSelect = (option) => {
    setSelectedEditAccess(option)
    setEditAccessSearch(option.label)
    setEditFormData({ ...editFormData, access_id: option.value })
  }

  const handleEditUserSubmit = async (event) => {
    event.preventDefault()
    setEditFormError('')
    setEditFormSuccess('')

    if (!editUser) {
      setEditFormError('No user selected to update.')
      return
    }

    if (!editFormData.access_id || !editFormData.status) {
      setEditFormError('Access role and status are required.')
      return
    }

    setEditSubmitting(true)

    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(API.usersById(editUser.id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          access_id: editFormData.access_id,
          status: editFormData.status,
          username: editUser.username,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to update user')
      }

      setEditFormSuccess('User updated successfully.')
      setShowEditForm(false)
      setEditUser(null)
      setEditFormData(EMPTY_EDIT_FORM)
      setEditAccessSearch('')
      setSelectedEditAccess({ value: '', label: '' })
      await fetchUsers()
    } catch (err) {
      setEditFormError(err.message || 'Failed to update user')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleCreateUserSubmit = async (event) => {
    event.preventDefault()
    setFormError('')
    setFormSuccess('')

    if (
      !formData.fullname ||
      !formData.username ||
      !formData.password ||
      !formData.access_id
    ) {
      setFormError('Full name, username, password, and access role are required.')
      return
    }

    setSubmitting(true)

    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        throw new Error('No authorization token found')
      }

      const response = await fetch(API.users(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to create user')
      }

      setFormSuccess('User created successfully.')
      setShowCreateForm(false)
      setFormData(EMPTY_CREATE_FORM)
      setAccessSearch('')
      setSelectedAccess({ value: '', label: '' })
      await fetchUsers()
    } catch (err) {
      setFormError(err.message || 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  return {
    users,
    loading,
    error,
    handleUserRowClick,
    fetchUsers,
    showCreateForm,
    accessOptions,
    accessSearch,
    selectedAccess,
    formData,
    formError,
    formSuccess,
    submitting,
    accessError,
    openCreateForm,
    closeCreateForm,
    handleAccessSearchChange,
    handleAccessSelect,
    handleCreateFormChange,
    handleCreateUserSubmit,
    showEditForm,
    editUser,
    editFormData,
    editAccessSearch,
    selectedEditAccess,
    editFormError,
    editFormSuccess,
    editSubmitting,
    openEditForm,
    closeEditForm,
    handleEditAccessSearchChange,
    handleEditAccessSelect,
    handleEditFormChange,
    handleEditUserSubmit,
  }
}

export default useUsers
