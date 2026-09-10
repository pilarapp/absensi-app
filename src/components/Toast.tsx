import React from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastProps {
  type?: ToastType;
  title?: string;
  description: string;
  onClose: () => void;
}

export default function Toast({ type = 'success', title, description, onClose }: ToastProps) {
  const getIcon = () => {
    switch (type) {
      case 'info': return <i className="fa-solid fa-circle-info text-gray-400"></i>;
      case 'success': return <i className="fa-solid fa-circle-check text-green-500"></i>;
      case 'warning': return <i className="fa-solid fa-triangle-exclamation text-yellow-500"></i>;
      case 'error': return <i className="fa-solid fa-circle-xmark text-red-500"></i>;
      default: return null;
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'info': return "Informasi";
      case 'success': return "Berhasil";
      case 'warning': return "Peringatan";
      case 'error': return "Gagal";
      default: return "Informasi";
    }
  };

  return (
    <div className="mb-4 flex items-start bg-[#011e48] text-white p-4 rounded-xl shadow-2xl border border-white/5 animate-slide-down relative w-full max-w-sm mx-auto z-50">
      <div className="mr-3 mt-0.5 text-xl flex-shrink-0">{getIcon()}</div>
      <div className="flex-1 pr-6">
        <h4 className="font-semibold text-sm">{getTitle()}</h4>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{description}</p>
      </div>
      <button 
        onClick={onClose} 
        type="button"
        className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
      >
        <i className="fa-solid fa-xmark text-sm"></i>
      </button>
    </div>
  );
}
