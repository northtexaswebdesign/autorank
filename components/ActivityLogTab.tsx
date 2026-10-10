
import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { ActivityLog } from '../types.ts';
import { LogsIcon } from './icons/LogsIcon.tsx';
import { CheckIcon } from './icons/CheckIcon.tsx';
import { CloseIcon } from './icons/CloseIcon.tsx';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon.tsx';

const LogItem: React.FC<{ log: ActivityLog }> = React.memo(({ log }) => {
    const statusConfig = {
        success: {
            icon: <CheckIcon className="w-4 h-4 text-green-600" />,
            text: 'text-stone-700'
        },
        error: {
            icon: <CloseIcon className="w-4 h-4 text-red-600" />,
            text: 'text-red-700 font-medium'
        },
        running: {
            icon: <LogsIcon className="w-4 h-4 text-stone-400" />,
            text: 'text-stone-500 italic'
        }
    };
    
    // Default to success if status is unknown, or use alert for generic
    const config = statusConfig[log.status] || { icon: <AlertTriangleIcon className="w-4 h-4 text-amber-500" />, text: 'text-stone-700' };

    return (
        <div className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors px-4 -mx-4">
            <div className="flex items-start gap-3 overflow-hidden">
                <div className="mt-0.5 flex-shrink-0">
                    {config.icon}
                </div>
                <div className="min-w-0">
                    <p className={`text-sm truncate pr-4 ${config.text}`}>
                        {log.status === 'error' ? (
                            <span className="font-semibold">Error: </span>
                        ) : null}
                        {log.message}
                    </p>
                </div>
            </div>
            <span className="text-xs text-stone-400 flex-shrink-0 whitespace-nowrap">
                {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
    );
});

export const ActivityLogTab: React.FC = () => {
    const { activityLogs } = useApp();
    
    const filteredLogs = useMemo(() => {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        threeDaysAgo.setHours(0, 0, 0, 0);

        return activityLogs.filter(log => {
            const logDate = new Date(log.createdAt);
            return logDate >= threeDaysAgo;
        });
    }, [activityLogs]);

    return (
        <div>
            <h1 className="font-serif text-4xl md:text-[44px] leading-none tracking-[-0.01em] text-stone-900">Activity log</h1>
            <p className="mt-1 text-stone-600 mb-8">Recent actions performed by your automation assistant.</p>
            
            <div className="bg-white border border-stone-200/80 rounded-xl shadow-sm overflow-hidden">
                {filteredLogs.length > 0 ? (
                    <div className="px-4 py-2">
                        {filteredLogs.map(log => <LogItem key={log.id} log={log} />)}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <LogsIcon className="w-12 h-12 mx-auto text-stone-300 mb-4" />
                        <h2 className="font-serif text-[26px] leading-tight text-stone-900">No Recent Activity</h2>
                        <p className="text-stone-500 mt-2">No automated actions recorded in the last 3 days.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
