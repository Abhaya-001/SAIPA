import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AvatarDropdown from '../ui/AvatarDropdown';
import SaipaLogo from '../ui/SaipaLogo';
import { Activity, BarChart2, Newspaper, Menu, X, Radio, Bot } from 'lucide-react';

const NAV_LINKS = [
    { to: '/dashboard', label: 'Dashboard', icon: Activity },
    { to: '/markets',   label: 'Markets',   icon: BarChart2 },
    { to: '/news',      label: 'News',      icon: Newspaper },
    { to: '/agent',     label: 'Agent',     icon: Bot },
];

export default function Navbar() {
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const drawerRef = useRef(null);

    useEffect(() => {
        if (!mobileOpen) return;
        const handleClick = (e) => {
            if (drawerRef.current && !drawerRef.current.contains(e.target)) {
                setMobileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [mobileOpen]);

    const isActive = (path) => location.pathname === path;

    const linkClass = (path) =>
        `saipa-nav-link ${isActive(path) ? 'saipa-nav-link-active' : ''}`;

    return (
        <nav
            ref={drawerRef}
            className="sticky top-0 z-40 transition-all duration-300
                bg-white/80 dark:bg-saipa-deep/80 backdrop-blur-xl
                border-b border-gray-200/80 dark:border-saipa-border
                shadow-sm dark:shadow-saipa"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setMobileOpen((o) => !o)}
                            className="sm:hidden btn-ghost"
                            aria-label="Toggle menu"
                        >
                            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>

                        <div className="hidden sm:block">
                            <SaipaLogo size="md" />
                        </div>

                        <div className="hidden sm:flex items-center gap-1 ml-4 pl-4 border-l border-gray-200 dark:border-saipa-border">
                            {NAV_LINKS.map(({ to, label, icon: NavIcon }) => (
                                <Link key={to} to={to} className={linkClass(to)}>
                                    {React.createElement(NavIcon, { className: 'w-4 h-4' })}
                                    {label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="sm:hidden absolute left-1/2 -translate-x-1/2">
                        <SaipaLogo size="sm" />
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 font-mono">
                            <Radio className="w-3 h-3 text-emerald-500 animate-pulse-soft" />
                            <span>SYS ONLINE</span>
                        </div>
                        <AvatarDropdown />
                    </div>
                </div>
            </div>

            <div
                className={`sm:hidden overflow-hidden transition-all duration-300 ease-saipa ${
                    mobileOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <div className="px-4 pb-4 pt-1 flex flex-col gap-1 border-t border-gray-100 dark:border-saipa-border bg-white/95 dark:bg-saipa-deep/95 backdrop-blur-xl">
                    {NAV_LINKS.map(({ to, label, icon: NavIcon }) => (
                        <Link key={to} to={to} className={linkClass(to)} onClick={() => setMobileOpen(false)}>
                            {React.createElement(NavIcon, { className: 'w-4 h-4' })}
                            {label}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}
