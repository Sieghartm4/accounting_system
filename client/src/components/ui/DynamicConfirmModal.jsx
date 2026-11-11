import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

const DynamicConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Yes',
  cancelText = 'No',
  type = 'warning', // warning, danger, info
}) => {
  const typeStyles = {
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-500',
      headerBg: 'bg-black',
      accentColor: 'bg-yellow-500',
      confirmBg: 'bg-yellow-500 hover:bg-yellow-600',
    },
    danger: {
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      headerBg: 'bg-black',
      accentColor: 'bg-red-600',
      confirmBg: 'bg-red-600 hover:bg-red-700',
    },
    info: {
      icon: AlertTriangle,
      iconColor: 'text-blue-500',
      headerBg: 'bg-black',
      accentColor: 'bg-blue-500',
      confirmBg: 'bg-blue-500 hover:bg-blue-600',
    },
  }

  const currentStyle = typeStyles[type] || typeStyles.warning
  const Icon = currentStyle.icon

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - transparent with blur like RightSideModal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg shadow-[-10px_0_30px_rgba(0,0,0,0.2)] max-w-md w-full overflow-hidden"
            >
              {/* Header - Black with accent line */}
              <div className={`${currentStyle.headerBg} px-6 py-5 flex items-center justify-between relative`}>
                {/* Accent line at bottom */}
                <div className={`absolute bottom-0 left-0 w-full h-[3px] ${currentStyle.accentColor}`} />

                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full bg-gray-800`}>
                    <Icon className={`w-5 h-5 ${currentStyle.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">{title}</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 bg-white">
                <p className="text-gray-700">{message}</p>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 p-4 bg-gray-50 border-t border-gray-100">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  className={`px-4 py-2 text-white rounded-lg transition-colors font-medium ${currentStyle.confirmBg}`}
                >
                  {confirmText}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default DynamicConfirmModal
