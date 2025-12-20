import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'default' | 'sm' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  isLoading,
  variant = 'primary',
  size = 'default',
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 focus:ring-blue-500 border border-transparent",
    secondary: "bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/30 focus:ring-purple-500 border border-transparent",
    outline: "border-2 border-slate-200 hover:border-blue-500 text-slate-600 hover:text-blue-600 bg-transparent",
    ghost: "text-slate-500 hover:text-slate-800 hover:bg-slate-100 bg-transparent",
    danger: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/30 focus:ring-red-500 border border-transparent",
  };

  const sizes = {
    default: "px-4 py-3 text-sm",
    sm: "px-3 py-2 text-xs",
    lg: "px-6 py-4 text-base"
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className={`mr-2 animate-spin ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`} />
          Carregando...
        </>
      ) : (
        children
      )}
    </button>
  );
};