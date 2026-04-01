import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = "Buscando informações..." }) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white shadow-2xl border border-slate-100">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-100 rounded-full animate-pulse"></div>
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin absolute inset-0" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-slate-900 font-black uppercase text-xs tracking-[0.2em]">{message}</p>
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-widest">Aguarde um momento</p>
        </div>
      </div>
    </div>
  );
};
