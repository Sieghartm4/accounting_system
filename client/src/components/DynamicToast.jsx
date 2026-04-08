import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X, ShieldAlert } from 'lucide-react';

const toastTypes = {
  success: {
    icon: <CheckCircle2 size={16} className="text-white" />,
    borderColor: 'border-green-500',
    indicator: 'bg-green-500',
    label: 'Success'
  },
  error: {
    icon: <ShieldAlert size={16} className="text-white" />,
    borderColor: 'border-red-600',
    indicator: 'bg-red-600',
    label: 'System Error'
  },
  warning: {
    icon: <AlertCircle size={16} className="text-white" />,
    borderColor: 'border-amber-500',
    indicator: 'bg-amber-500',
    label: 'Attention'
  },
  info: {
    icon: <Info size={16} className="text-white" />,
    borderColor: 'border-black',
    indicator: 'bg-black',
    label: 'Information'
  }
};

const DynamicToast = ({ type = 'success', message, onClose, duration = 4000 }) => {
  const config = toastTypes[type] || toastTypes.info;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div 
      className="fixed top-6 right-6 z-[200] animate-in slide-in-from-right-8 fade-in duration-300 cursor-pointer"
      onClick={onClose}
    >
      <div className={`
        relative w-80 bg-white shadow-[0_15px_50px_-12px_rgba(0,0,0,0.25)] 
        rounded-xl border-l-4 ${config.borderColor} overflow-hidden
      `}>
        
        <div className="flex items-start p-4"> {/* Added items-start here */}
          
          {/* Icon Section - Added h-fit and flex center to keep it square */}
          <div className={`
            flex-shrink-0 w-8 h-8 flex items-center justify-center 
            rounded-lg ${config.indicator} shadow-lg shadow-black/10
          `}>
            {config.icon}
          </div>

          {/* Text Content */}
          <div className="ml-4 flex-1 pt-0.5"> {/* Added slight pt for alignment */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[2px] text-gray-400">
                {config.label}
              </span>
              <button 
                onClick={onClose}
                className="text-gray-300 hover:text-red-600 transition-colors p-1"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-xs font-bold text-black mt-1 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Progress Bar moved below the content for cleaner design */}
        <div className="h-[3px] bg-gray-50 w-full overflow-hidden">
           <div 
             className={`h-full ${config.indicator} transition-all duration-100 ease-linear`}
             style={{ animation: `shrinkWidth ${duration}ms linear forwards` }}
           />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}} />
    </div>
  );
};

export default DynamicToast;