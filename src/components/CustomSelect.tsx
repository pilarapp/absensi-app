"use client";
import React, { useState, useRef, useEffect } from "react";

export interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export default function CustomSelect({ value, onChange, options, placeholder, className }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex justify-between items-center bg-white border border-gray-200 rounded-xl px-4 py-3 cursor-pointer focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all text-sm font-bold text-gray-700 ${className || ''}`}
      >
        <span>{selectedOption ? selectedOption.label : (placeholder || "Pilih...")}</span>
        <i className={`fa-solid fa-chevron-down text-gray-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}></i>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95">
          <ul className="max-h-60 overflow-y-auto py-1">
            {options.map((opt) => (
              <li 
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`px-4 py-3 text-sm cursor-pointer transition-colors flex justify-between items-center
                  ${value === opt.value ? 'bg-pilar-gold/10 text-pilar-darker font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                {opt.label}
                {value === opt.value && <i className="fa-solid fa-check text-pilar-darker text-xs"></i>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
