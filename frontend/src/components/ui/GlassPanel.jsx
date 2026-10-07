import React from 'react';

export default function GlassPanel({ children, className = '', hover = false }) {
    return (
        <div className={`system-module ${hover ? 'system-module-hover' : ''} p-8 sm:rounded-2xl sm:px-10 ${className}`}>
            {children}
        </div>
    );
}
