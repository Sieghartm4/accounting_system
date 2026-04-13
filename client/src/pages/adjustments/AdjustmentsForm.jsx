import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, X, Plus, Trash2, Paperclip, FileText } from 'lucide-react';
import DynamicToast from '../../components/DynamicToast';
import RightSideModal from '../../components/RightSideModal';

const AdjustmentsForm = ({ onBack, onSuccess, isViewMode = false, adjustmentData = null }) => {
  // ── Form state ──────────────────────────────────────────────────────
  const [documentReference, setDocumentReference] = useState('');
  const [postingDate, setPostingDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState('PREPARED BY');
  const [totalAmount, setTotalAmount] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [createdDate, setCreatedDate] = useState('');

  const [attachments, setAttachments] = useState([
    { id: 1, fileName: '', file: null, remarks: '', uploadedBy: 'Current User', date: new Date().toLocaleDateString() }
  ]);

  const [toast, setToast] = useState(null);
  const [imageModal, setImageModal] = useState({ isOpen: false, imageSrc: '' });

  const statusOptions = ['PREPARED BY', 'CHECKED BY', 'APPROVED BY', 'REJECTED BY'];

  // ── Populate form with adjustment data when in view mode ──────────────────────
  useEffect(() => {
    if (isViewMode && adjustmentData) {
      console.log('Populating form with adjustment data:', adjustmentData);
      
      // Populate basic adjustment info
      if (adjustmentData.data && adjustmentData.data.length > 0) {
        const adjustment = adjustmentData.data[0];
        setDocumentReference(adjustment.a_document_reference || '');
        setPostingDate(adjustment.a_posting_date || '');
        setRemarks(adjustment.a_remarks || '');
        setStatus(adjustment.a_status || 'PREPARED BY');
        setTotalAmount(adjustment.a_total_amount || '');
        setCreatedBy(adjustment.a_created_by || '');
        setCreatedDate(adjustment.a_created_date || '');
      }

      // Populate attachments
      if (adjustmentData.attachments && adjustmentData.attachments.length > 0) {
        console.log('Processing attachments:', adjustmentData.attachments);
        const attachments = adjustmentData.attachments.map(att => {
          console.log('Processing attachment:', att.id, att.name, 'File data type:', typeof att.file, 'File data length:', att.file ? att.file.length : 'null');
          return {
            id: att.id,
            fileName: att.name || '',
            file: att.file || null, // Preserve base64 data from server for view mode
            remarks: att.remarks || '',
            uploadedBy: att.uploaded_by || 'Current User',
            date: att.uploaded_date || new Date().toLocaleDateString()
          };
        });
        console.log('Final attachments array:', attachments);
        setAttachments(attachments);
      }
    }
  }, [isViewMode, adjustmentData]);

  // ── Attachment helpers ────────────────────────────────────────────────────
  const addAttachment = () => setAttachments(prev => [...prev, { id: Date.now(), fileName: '', file: null, remarks: '', uploadedBy: 'Current User', date: new Date().toLocaleDateString() }]);
  const removeAttachment = (id) => setAttachments(prev => prev.filter(a => a.id !== id));
  const updateAttachment = (id, field, value) => setAttachments(prev => prev.map(att => att.id === id ? { ...att, [field]: value } : att));

  const handleFileChange = (id, file) => {
    if (file) {
      updateAttachment(id, 'fileName', file.name);
      updateAttachment(id, 'file', file);
    }
  };

  // ── Post Transaction ──────────────────────────────────────────────────────
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = err => reject(err);
    });

  const handlePostTransaction = async () => {
    try {
      if (!documentReference) { setToast({ type: 'warning', message: 'Please enter document reference' }); return; }
      if (!postingDate) { setToast({ type: 'warning', message: 'Please enter posting date' }); return; }
      if (!totalAmount || parseFloat(totalAmount) <= 0) { setToast({ type: 'warning', message: 'Please enter valid total amount' }); return; }

      const token = localStorage.getItem('token');
      if (!token) { setToast({ type: 'error', message: 'No authorization token found. Please login again.' }); return; }

      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const createdBy = userData.mu_username || userData.username || 'Unknown User';

      const preparedAttachments = await Promise.all(
        attachments.map(async att => ({
          name: att.fileName,
          file: att.file ? await fileToBase64(att.file) : null,
          remarks: att.remarks,
          uploaded_by: att.uploadedBy,
          uploaded_date: att.date,
        }))
      );

      // ── adjustment header payload ──
      const adjustmentPayload = {
        a_document_reference: documentReference,
        a_posting_date: postingDate,
        a_remarks: remarks,
        a_status: status,
        a_total_amount: parseFloat(totalAmount),
        a_created_date: new Date().toISOString().split('T')[0],
        a_created_by: createdBy,
        adjustment_attachments: preparedAttachments,
      };

      const url = isViewMode && adjustmentData 
        ? `${import.meta.env.VITE_SERVER_LINK}/adjustments/${adjustmentData.data[0].a_id}`
        : `${import.meta.env.VITE_SERVER_LINK}/adjustments`;
      
      const method = isViewMode && adjustmentData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(adjustmentPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        const nextToast = { type: 'success', message: isViewMode ? 'Adjustment updated successfully!' : 'Adjustment posted successfully!' };
        setToast(nextToast);
        if (onSuccess) await onSuccess(nextToast);
        onBack();
      } else {
        setToast({ type: 'error', message: result.message || 'Failed to save adjustment' });
      }

    } catch (error) {
      console.error('Error saving adjustment:', error);
      setToast({ type: 'error', message: 'Error: ' + error.message });
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputBase = "w-full px-3 py-2 rounded-lg text-sm font-medium outline-none transition-all " + 
    (isViewMode ? "bg-gray-100 border border-gray-300 text-black cursor-not-allowed" : "bg-gray-50 border border-gray-200 text-black focus:ring-2 focus:ring-red-500");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <button
              onClick={onBack}
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">
              {isViewMode ? 'View Adjustment' : 'Create Adjustment'}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Adjustment Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-red-600" />
              Adjustment Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Reference <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={documentReference}
                  onChange={(e) => setDocumentReference(e.target.value)}
                  disabled={isViewMode}
                  className={inputBase}
                  placeholder="Enter document reference..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Posting Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={postingDate}
                  onChange={(e) => setPostingDate(e.target.value)}
                  disabled={isViewMode}
                  className={inputBase}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Amount <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  disabled={isViewMode}
                  className={inputBase}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={isViewMode}
                  className={inputBase}
                >
                  {statusOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remarks
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={isViewMode}
                rows={4}
                className={`${inputBase} resize-none`}
                placeholder="Enter adjustment remarks..."
              />
            </div>
          </div>

          {/* Attachments */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
              <Paperclip className="h-5 w-5 mr-2 text-red-600" />
              Attachments
            </h2>
            
            <div className="space-y-4">
              {attachments.map((attachment, index) => (
                <div key={attachment.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={attachment.fileName}
                      onChange={(e) => updateAttachment(attachment.id, 'fileName', e.target.value)}
                      disabled={isViewMode}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="File name..."
                    />
                  </div>
                  
                  <div className="flex-1">
                    <input
                      type="text"
                      value={attachment.remarks}
                      onChange={(e) => updateAttachment(attachment.id, 'remarks', e.target.value)}
                      disabled={isViewMode}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="File remarks..."
                    />
                  </div>

                  <div className="flex-1">
                    {isViewMode ? (
                      <div className="text-sm text-gray-600">
                        {attachment.file && typeof attachment.file === 'string' && attachment.file.startsWith('data:image/') ? (
                          <img 
                            src={attachment.file} 
                            alt={attachment.fileName || 'Attachment'} 
                            className="h-8 w-8 object-cover rounded cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setImageModal({ isOpen: true, imageSrc: attachment.file })}
                            title="Click to view full size"
                          />
                        ) : attachment.file ? (
                          <span className="text-blue-600 text-xs">File attached</span>
                        ) : (
                          <span className="text-gray-400 text-xs">No file</span>
                        )}
                      </div>
                    ) : (
                      <input
                        type="file"
                        onChange={(e) => handleFileChange(attachment.id, e.target.files[0])}
                        className="w-full text-sm text-gray-600 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-red-600 file:text-white cursor-pointer"
                      />
                    )}
                  </div>

                  {!isViewMode && (
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!isViewMode && (
              <button
                onClick={addAttachment}
                className="mt-4 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-red-500 hover:text-red-600 transition-colors flex items-center justify-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Attachment
              </button>
            )}
          </div>

          {/* Action Buttons */}
          {!isViewMode && (
            <div className="flex justify-end space-x-4">
              <button
                onClick={onBack}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePostTransaction}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Adjustment
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Image Modal */}
      {imageModal.isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setImageModal({ isOpen: false, imageSrc: '' })}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setImageModal({ isOpen: false, imageSrc: '' });
            }}
            className="absolute top-6 right-6 text-white hover:text-red-500 transition-colors"
          >
            <X size={32} />
          </button>
          <img
            src={imageModal.imageSrc}
            alt="Preview"
            className="max-w-full max-h-full rounded-2xl shadow-2xl border-4 border-white/10 p-2 scale-in animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default AdjustmentsForm;
