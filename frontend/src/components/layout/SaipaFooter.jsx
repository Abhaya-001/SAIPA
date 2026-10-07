import React from 'react';

export default function SaipaFooter() {
  return (
    <footer className="relative z-10 mt-auto py-6 px-4 border-t border-gray-200/50 dark:border-saipa-border/50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 dark:text-slate-500">
        <span className="font-display tracking-wider text-gray-500 dark:text-slate-400">
          SAIPA
        </span>
        <span className="italic">
          Made with Love by Seshu &amp; Abhay
        </span>
      </div>
    </footer>
  );
}
