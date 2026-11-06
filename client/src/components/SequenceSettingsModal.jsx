import { useEffect, useState } from 'react'
import RightSideModal from './RightSideModal'
import {
  SEQUENCE_MODULES,
  SEQUENCE_DATE_FORMATS,
  moduleLabel,
  buildSequencePreview,
} from '../pages/sequence_settings/useSequenceSettings'
import useSequenceSettings from '../pages/sequence_settings/useSequenceSettings'

/**
 * The add/edit sequence modal, shared by the Masters sequence page and the
 * "Edit Sequence" button on each transaction page. With a `module` prop it
 * edits that module's id format directly (transaction pages); without one it
 * shows the module picker first (Masters "Add New").
 */
const SequenceSettingsModal = ({ isOpen, onClose, module = null, onSaved = null }) => {
  const { settings, loading, saving, error, fetchSequenceSettings, getSettingForModule, saveForModule } =
    useSequenceSettings()

  const [selectedModule, setSelectedModule] = useState(module)
  const [form, setForm] = useState(null)
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedModule(module)
      setFormError(null)
      fetchSequenceSettings()
    }
  }, [isOpen, module, fetchSequenceSettings])

  useEffect(() => {
    if (!isOpen) return
    const target = selectedModule || module
    if (!target) {
      setForm(null)
      return
    }
    const setting = getSettingForModule(target)
    setForm({
      prefix: setting.prefix || '',
      date_format: setting.date_format || 'MMDDYY',
      padding: setting.padding ?? 4,
      next_sequence: setting.next_sequence ?? 1,
    })
  }, [isOpen, selectedModule, module, getSettingForModule, settings])

  const isEditMode = Boolean(module) || settings.some((row) => row.module === selectedModule)
  const availableModules = isEditMode
    ? null
    : SEQUENCE_MODULES.filter((m) => !settings.some((row) => row.module === m.code))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form || !selectedModule) return

    if (!/^[A-Z0-9]{1,6}$/.test(form.prefix.trim().toUpperCase())) {
      setFormError('Prefix must be 1-6 letters/numbers (no dashes)')
      return
    }

    const result = await saveForModule(selectedModule, {
      prefix: form.prefix,
      date_format: form.date_format,
      padding: form.padding,
      next_sequence: form.next_sequence,
    })

    if (result.success) {
      if (onSaved) onSaved({ success: true, module: selectedModule })
      onClose()
    } else {
      setFormError(result.message || 'Failed to save sequence')
    }
  }

  return (
    <RightSideModal
      isOpen={isOpen}
      onClose={() => {
        onClose()
      }}
      title={isEditMode ? 'Edit Sequence' : 'Create Sequence'}
    >
      {loading ? (
        <div className="py-10 text-center text-sm font-bold text-gray-400 uppercase tracking-widest">
          Loading sequence settings...
        </div>
      ) : error ? (
        <div className="py-10 text-center text-sm font-bold text-red-600">{error}</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {!module && !isEditMode ? (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Module <span className="text-red-600">*</span>
              </label>
              <select
                value={selectedModule || ''}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                required
              >
                <option value="">Select module...</option>
                {availableModules.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Module
              </label>
              <div className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">
                {moduleLabel(selectedModule || module)}
              </div>
            </div>
          )}

          {form && (
            <>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                  Prefix <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={form.prefix}
                  onChange={(e) => {
                    setForm({ ...form, prefix: e.target.value.toUpperCase() })
                    setFormError(null)
                  }}
                  maxLength={6}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold uppercase focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                  placeholder="eg CR"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                  Date Group
                </label>
                <select
                  value={form.date_format}
                  onChange={(e) => setForm({ ...form, date_format: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                >
                  {SEQUENCE_DATE_FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Number Digits
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={form.padding}
                    onChange={(e) => setForm({ ...form, padding: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                    Starting Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.next_sequence}
                    onChange={(e) => setForm({ ...form, next_sequence: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">
                  Document ids continue from your most recent document; the starting
                  number only applies when none exists yet
                </p>
                <p className="text-sm font-black text-black font-mono tracking-wide">
                  {buildSequencePreview(form)}
                </p>
              </div>

              {formError && (
                <p className="text-xs font-bold text-red-600">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 text-xs font-black rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-black text-white text-xs font-black rounded-xl hover:bg-red-600 transition-all uppercase tracking-widest disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Sequence'}
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </RightSideModal>
  )
}

export default SequenceSettingsModal
