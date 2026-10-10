import React, { useState, useEffect } from 'react';
import { CmsIntegration } from '../types.ts';
import { useApp } from '../context/AppContext.tsx';
import { LinkIcon } from './icons/LinkIcon.tsx';
import { InputField } from './common/InputField.tsx';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

export const CMSIntegrationTab: React.FC = () => {
    const { cmsIntegration, updateCmsIntegration } = useApp();
    
    const [formData, setFormData] = useState<Omit<CmsIntegration, 'id' | 'businessId' | 'platform'>>({
        url: '',
        username: '',
        applicationPassword: '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        if (cmsIntegration) {
            setFormData({
                url: cmsIntegration.url || '',
                username: cmsIntegration.username || '',
                applicationPassword: cmsIntegration.applicationPassword || '',
            });
        }
    }, [cmsIntegration]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setConnectionStatus('idle');
        setStatusMessage('');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateCmsIntegration(formData);
            alert("Settings saved successfully!");
        } catch (err: any) {
            alert(err?.message || 'Could not save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setConnectionStatus('testing');
        setStatusMessage('Testing connection...');

        if (!formData.url || !formData.username || !formData.applicationPassword || !formData.url.includes('http')) {
            setConnectionStatus('error');
            setStatusMessage('Please fill in all fields with valid data.');
            return;
        }

        try {
            const auth = btoa(`${formData.username}:${formData.applicationPassword}`);
            const res = await fetch(`${formData.url}/wp-json/wp/v2/users/me`, {
                headers: { 'Authorization': `Basic ${auth}` }
            });

            if (res.ok) {
                setConnectionStatus('success');
                setStatusMessage('Connection successful!');
            } else {
                setConnectionStatus('error');
                setStatusMessage(`Connection failed: ${res.statusText}`);
            }
        } catch (e: any) {
            setConnectionStatus('error');
            if (e.message === 'Failed to fetch') {
                setStatusMessage('CORS error or invalid URL. Ensure your site allows cross-origin requests.');
            } else {
                setStatusMessage(`Error: ${e.message}`);
            }
        }
    };

    const getStatusIndicatorClass = () => {
        switch (connectionStatus) {
            case 'success': return 'bg-orange-500';
            case 'error': return 'bg-stone-500';
            case 'testing': return 'bg-amber-500 animate-pulse';
            default: return 'bg-slate-300';
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-8">CMS Integrations</h1>
            <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <form onSubmit={handleSave} className="space-y-6 bg-white border border-slate-200/80 p-8 rounded-xl shadow-sm">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">Connect to WordPress</h2>
                        <p className="text-sm text-slate-500 mt-1">Connect your website to enable direct publishing.</p>
                    </div>

                    <InputField label="WordPress Site URL" name="url" value={formData.url} onChange={handleChange} placeholder="https://yourblog.com" type="url" />
                    <InputField label="WordPress Username" name="username" value={formData.username} onChange={handleChange} placeholder="your_wp_username" />
                    <InputField label="Application Password" name="applicationPassword" value={formData.applicationPassword || ''} onChange={handleChange} type="password" placeholder="••••••••••••••••" />
                    
                    <div className="flex items-center justify-between pt-4">
                        <div className="flex items-center gap-2">
                             <div className={`w-3 h-3 rounded-full ${getStatusIndicatorClass()}`}></div>
                             <span className="text-sm text-slate-600">{statusMessage || 'Status: Idle'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={connectionStatus === 'testing'}
                                className="bg-slate-100 text-slate-700 px-4 py-2 text-sm rounded-lg font-semibold hover:bg-slate-200 disabled:bg-slate-300"
                            >
                                {connectionStatus === 'testing' ? 'Testing...' : 'Test'}
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-4 py-2 text-sm rounded-lg font-semibold hover:from-amber-500 hover:to-orange-600 disabled:from-slate-400 disabled:to-slate-400"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </form>

                 <div className="bg-slate-100 border border-slate-200/50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center mb-3">
                        <LinkIcon className="w-5 h-5 mr-2 text-slate-500" />
                        What is an Application Password?
                    </h3>
                    <div className="text-sm text-slate-600 space-y-3">
                        <p>An Application Password is a special password you generate in your WordPress dashboard. It allows external applications like Autorank AI to securely connect to your site without using your main password.</p>
                        <p className="font-semibold">How to create one:</p>
                        <ol className="list-decimal list-inside space-y-1">
                            <li>Log in to your WordPress admin dashboard.</li>
                            <li>Go to <span className="font-mono bg-slate-200 px-1 py-0.5 rounded text-xs">Users &rarr; Profile</span>.</li>
                            <li>Scroll down to the "Application Passwords" section.</li>
                            <li>Enter a name (e.g., "Autorank AI") and click "Add New...".</li>
                            <li>Copy the generated password and paste it into the field on this page.</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
};