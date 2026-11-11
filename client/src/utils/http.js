// Shared fetch helpers for pages. Mirrors the per-page pattern of building
// headers from the `authenticated` session value. Note that utils/api.js
// installs a global fetch interceptor (adds credentials, handles 401/402).

export const getAuthToken = () => {
  const token = sessionStorage.getItem('authenticated')
  if (!token) throw new Error('No authorization token found')
  return token
}

export const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAuthToken()}`,
})

// fetchJson auto-parses the response body and returns { ok, result }.
export const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options)
  const result = await response.json()
  return { ok: response.ok, result }
}

export const fetchJson = async (url, options = {}) => {
  const { result } = await requestJson(url, options)
  return result
}
