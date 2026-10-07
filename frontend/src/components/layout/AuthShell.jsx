import React from 'react';
import ThemeToggle from '../ThemeToggle';
import OrbitalBackground from '../background/OrbitalBackground';
import SaipaLogo from '../ui/SaipaLogo';

export default function AuthShell({ children }) {
    return (
        <div className="auth-shell relative overflow-hidden">
            <div className="fixed inset-0 z-0 pointer-events-none">
                <OrbitalBackground variant="auth" />
                <div className="absolute inset-0 bg-saipa-radial opacity-70 dark:opacity-100" />
            </div>

            <ThemeToggle className="absolute top-4 right-4 z-50" />

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 animate-fade-in">
                <div className="flex justify-center mb-6">
                    <SaipaLogo size="lg" linkTo={null} />
                </div>
                {children}
            </div>

            <p className="relative z-10 text-center text-xs text-gray-400 dark:text-slate-500 italic mt-8 pb-6">
                Made with Love by Seshu &amp; Abhay
            </p>
        </div>
    );
}
