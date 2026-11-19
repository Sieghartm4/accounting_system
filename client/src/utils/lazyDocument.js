const detailCache = new Map()
const inflightDetails = new Map()

const cacheKey = (moduleKey, id) => `${moduleKey}:${id}`

export const seedDocumentFromRow = (row) => ({
  data: [row],
  items: [],
  journal: [],
  attachments: [],
})

export const getCachedDocument = (moduleKey, id) =>
  detailCache.get(cacheKey(moduleKey, id))

export const cacheDocument = (moduleKey, id, document) => {
  detailCache.set(cacheKey(moduleKey, id), document)
}

export const clearDocumentCache = (moduleKey, id) => {
  if (id === undefined || id === null) {
    for (const key of detailCache.keys()) {
      if (key.startsWith(`${moduleKey}:`)) detailCache.delete(key)
    }
    return
  }

  detailCache.delete(cacheKey(moduleKey, id))
}

export const fetchDocumentDetail = async ({
  moduleKey,
  id,
  endpoint,
  token,
}) => {
  const key = cacheKey(moduleKey, id)

  if (detailCache.has(key)) return detailCache.get(key)
  if (inflightDetails.has(key)) return inflightDetails.get(key)

  const request = (async () => {
    if (!token) throw new Error('No authentication token found')

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.message || 'Failed to fetch document details')
    }

    detailCache.set(key, result)
    return result
  })()

  inflightDetails.set(key, request)

  try {
    return await request
  } finally {
    inflightDetails.delete(key)
  }
}

export const fetchAttachmentFile = async ({
  endpoint,
  token,
  id,
  attachmentId,
}) => {
  if (!token) throw new Error('No authentication token found')

  const response = await fetch(endpoint(id, attachmentId), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.message || 'Failed to fetch attachment file')
  }

  return result?.data?.file || null
}
