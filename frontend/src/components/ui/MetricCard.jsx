import React from 'react';

export default function MetricCard({ label, value, valueClassName = 'text-primary-500 dark:text-primary-400', icon: Icon, loading }) {
    return (
        <div className="metric-card animate-fade-in-up">
            <div className="flex items-start justify-between relative z-10">
                <div>
                    <h3 className="metric-label">{label}</h3>
                    <p className={`metric-value ${valueClassName}`}>
                        {loading ? '...' : value}
                    </p>
                </div>
                {Icon && (
                    <div className="p-2 rounded-xl bg-primary-500/10 dark:bg-primary-400/10">
                        <Icon className="w-4 h-4 text-primary-500 dark:text-primary-400" />
                    </div>
                )}
            </div>
        </div>
    );
}
