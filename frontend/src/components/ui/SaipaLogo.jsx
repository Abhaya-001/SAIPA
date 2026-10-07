import React from 'react';
import { Link } from 'react-router-dom';

export default function SaipaLogo({ className = '', linkTo = '/dashboard', size = 'md' }) {
  const sizes = {
    sm: 'text-base tracking-[0.35em]',
    md: 'text-xl tracking-[0.4em]',
    lg: 'text-2xl tracking-[0.45em]',
  };

  const content = (
    <span className={`font-display font-bold text-gray-900 dark:text-white ${sizes[size]} ${className}`}>
      <span className="text-primary-500 dark:text-primary-400">S</span>
      <span className="text-gray-400 dark:text-slate-500 mx-0.5">·</span>
      <span>A</span>
      <span className="text-gray-400 dark:text-slate-500 mx-0.5">·</span>
      <span>I</span>
      <span className="text-gray-400 dark:text-slate-500 mx-0.5">·</span>
      <span>P</span>
      <span className="text-gray-400 dark:text-slate-500 mx-0.5">·</span>
      <span className="text-primary-500 dark:text-primary-400">A</span>
    </span>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="group flex-shrink-0 transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
