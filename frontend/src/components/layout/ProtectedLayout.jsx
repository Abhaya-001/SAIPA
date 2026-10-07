import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import SaipaFooter from './SaipaFooter';
import OrbitalBackground from '../background/OrbitalBackground';

export default function ProtectedLayout() {
    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden bg-gray-50 dark:bg-saipa-void transition-colors duration-300">
            {/* Deep-space orbital environment */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <OrbitalBackground variant="full" />
                <div className="absolute inset-0 bg-saipa-radial opacity-60 dark:opacity-100" />
            </div>

            <Navbar />

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
                <Outlet />
            </main>

            <SaipaFooter />
        </div>
    );
}
