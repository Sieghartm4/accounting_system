import { useState } from 'react'

const isImageFile = (file) =>
  typeof file === 'string' && file.startsWith('data:image/')

const formatSize = (bytes) => {
  const size = Number(bytes) || 0
  if (size < 1024) return `${size}B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`
  return `${(size / (1024 * 1024)).toFixed(1)}MB`
}

const openFile = (file, fileName) => {
  if (typeof file !== 'string' || !file) return

  const link = document.createElement('a')
  link.href = file
  link.target = '_blank'
  link.rel = 'noopener,noreferrer'
  link.download = fileName || 'attachment'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export default function LazyAttachmentFile({
  attachment,
  fetchFile,
  onFileLoaded,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const file = attachment?.file || attachment?.File || null
  const fileName = attachment?.fileName || attachment?.name || 'attachment'
  const hasFile = Boolean(file || attachment?.has_file)
  const sizeBytes =
    attachment?.file_size ?? attachment?.fileSize ?? (file ? String(file).length : 0)

  const handleLoad = async () => {
    if (!fetchFile || loading || attachment?.id === undefined) return

    setLoading(true)
    setError('')

    try {
      const loadedFile = await fetchFile(attachment.id)
      if (loadedFile) {
        onFileLoaded?.(attachment.id, loadedFile)
      } else {
        setError('File is unavailable')
      }
    } catch (err) {
      setError(err?.message || 'Failed to load file')
    } finally {
      setLoading(false)
    }
  }

  if (file && isImageFile(file)) {
    return (
      <div className="flex flex-col items-center">
        <img
          src={file}
          alt={fileName}
          className="max-h-16 max-w-full object-contain cursor-pointer hover:scale-105 transition-transform"
          onClick={() => openFile(file, fileName)}
          title="Click to view full size"
        />
        <span className="text-[8px] text-gray-500">{formatSize(sizeBytes)}</span>
      </div>
    )
  }

  if (file) {
    return (
      <div className="flex flex-col items-center">
        <span
          className="text-blue-600 text-[11px] font-bold cursor-pointer hover:underline break-all text-center leading-tight"
          onClick={() => openFile(file, fileName)}
          title="Click to open file"
        >
          {fileName}
        </span>
        <span className="text-[8px] text-gray-500">{formatSize(sizeBytes)}</span>
      </div>
    )
  }

  if (hasFile) {
    return (
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={handleLoad}
          disabled={loading}
          className="text-blue-600 text-[11px] font-bold cursor-pointer hover:underline disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading…' : fileName}
        </button>
        <span className="text-[8px] text-gray-500">
          {attachment?.file_size ? `${formatSize(sizeBytes)} · click to load` : 'click to load'}
        </span>
        {error && <span className="text-[8px] text-red-600">{error}</span>}
      </div>
    )
  }

  return (
    <span className="text-gray-400 text-[11px] italic">
      {error || 'No file'}
    </span>
  )
}
