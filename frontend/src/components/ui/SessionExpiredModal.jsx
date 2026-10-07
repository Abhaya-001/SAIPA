import React from 'react';
import { LogIn, Clock } from 'lucide-react';

export default function SessionExpiredModal({ onLogin }) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative system-module w-full max-w-sm p-8 flex flex-col items-center gap-5 animate-fade-in-up">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center border border-amber-500/20">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1 font-display">
            Session Expired
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Your login session has expired. Please sign in again to continue.
          </p>
        </div>

        <button
          onClick={onLogin}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <LogIn className="w-4 h-4" />
          Sign In Again
        </button>
      </div>
    </div>
  );
}
