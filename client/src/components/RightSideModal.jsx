import React from 'react';

const RightSideModal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - darker for better focus */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal - Pure White with Black/Red accents */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.2)] z-[90] transform transition-transform duration-300 ease-in-out animate-in slide-in-from-right">
        
        {/* Header - Now Black with a Red indicator */}
        <div className="bg-black px-6 py-5 flex items-center justify-between relative">
          {/* Subtle red line at the bottom of header */}
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-red-600" />
          
          <div className="flex flex-col">
            <h2 className="text-lg font-black text-white uppercase tracking-tight">{title}</h2>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[2px]">5L Allied Services</span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-all duration-200"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-white">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
            {children}
          </div>
        </div>

        {/* Optional Footer Bar - to keep it consistent with the table theme */}
        <div className="absolute bottom-0 w-full bg-gray-50 border-t border-gray-100 p-4 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">Confidential Accounting Record</p>
        </div>
      </div>
    </>
  );
};

export default RightSideModal;