import React from 'react';

const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary w-auto',
    ghost: 'btn-ghost w-auto',
    outline: 'btn-secondary w-auto bg-transparent',
};

export default function Button({
    children,
    className = '',
    disabled,
    isLoading,
    icon: Icon,
    variant = 'primary',
    ...props
}) {
    return (
        <button
            disabled={disabled || isLoading}
            className={`${variants[variant] || variants.primary} flex justify-center items-center gap-2 ${
                disabled || isLoading ? 'opacity-70 cursor-not-allowed' : ''
            } ${className}`}
            {...props}
        >
            {isLoading ? 'Processing...' : children}
            {(!isLoading && Icon) && <Icon className="w-4 h-4" />}
        </button>
    );
}
