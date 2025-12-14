import React, { forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  labelClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon: Icon, className = '', labelClassName = '', ...props }, ref) => {
    return (
      <div className="w-full space-y-2">
        {label && (
          <label className={`block text-sm font-medium ${labelClassName || 'text-slate-700 dark:text-slate-300'}`}>
            {label}
          </label>
        )}
        <div className="relative group">
          {Icon && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors duration-200">
              <Icon className="w-5 h-5" />
            </div>
          )}
          <input
            ref={ref}
            className={`
              block w-full rounded-xl border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400
              focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50
              transition-all duration-200 ease-in-out
              disabled:opacity-50 disabled:bg-slate-100
              py-3 ${Icon ? 'pl-10' : 'pl-3'} pr-3
              border ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm text-red-500 mt-1 animate-fadeIn">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';