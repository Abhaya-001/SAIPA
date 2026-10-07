import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { User, Settings, Key, LogOut } from 'lucide-react';

export default function AvatarDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getInitials = (name, email) => {
        if (name) {
            return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        }
        return email ? email.substring(0, 2).toUpperCase() : '??';
    };

    const menuItemClass = "flex items-center px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-saipa-surface/80 w-full text-left transition-colors duration-150";

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center w-10 h-10 rounded-full
                    bg-gradient-to-br from-primary-500 to-primary-600 text-white
                    hover:from-primary-400 hover:to-primary-500
                    focus:outline-none focus:ring-2 focus:ring-primary-400/40
                    transition-all duration-200 shadow-saipa-glow overflow-hidden"
            >
                {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="User Avatar" className="w-full h-full object-cover" />
                ) : (
                    <span className="text-sm font-medium tracking-wide font-mono">
                        {user ? getInitials(user.full_name, user.email) : 'U'}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl
                    bg-white dark:bg-saipa-panel backdrop-blur-xl
                    shadow-saipa-hover border border-gray-200 dark:border-saipa-border
                    divide-y divide-gray-100 dark:divide-saipa-border/50 z-50 animate-fade-in">
                    <div className="px-4 py-3">
                        <p className="text-sm text-gray-900 dark:text-white truncate font-medium font-display">
                            {user?.full_name || 'Portfolio User'}
                        </p>
                        <p className="text-xs font-mono text-gray-500 dark:text-slate-400 truncate mt-0.5">
                            {user?.email}
                        </p>
                    </div>

                    <div className="py-1">
                        <Link to="/profile" onClick={() => setIsOpen(false)} className={menuItemClass}>
                            <User className="mr-3 h-4 w-4 text-gray-400 dark:text-slate-500" />
                            Your Profile
                        </Link>
                        <Link to="/api-keys" onClick={() => setIsOpen(false)} className={menuItemClass}>
                            <Key className="mr-3 h-4 w-4 text-gray-400 dark:text-slate-500" />
                            Manage API Keys
                        </Link>
                        <Link to="/settings" onClick={() => setIsOpen(false)} className={menuItemClass}>
                            <Settings className="mr-3 h-4 w-4 text-gray-400 dark:text-slate-500" />
                            Settings
                        </Link>
                    </div>

                    <div className="py-1">
                        <button onClick={handleLogout} className={`${menuItemClass} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}>
                            <LogOut className="mr-3 h-4 w-4" />
                            Sign out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
