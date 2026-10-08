
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { supabase } from '../services/supabaseClient.ts';
import { CheckIcon } from './icons/CheckIcon.tsx';
import type { User } from '@supabase/supabase-js';
import { getStripeCheckoutUrl } from '../utils/stripe.ts';

const PlanFeature: React.FC<{ text: string }> = ({ text }) => (
    <li className="flex items-start">
        <CheckIcon className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
        <span className="text-slate-600 text-sm">{text}</span>
    </li>
);

export const AccountSettingsTab: React.FC = () => {
    const { userProfile, updateUserProfile, isSubscriptionExpired } = useApp();
    const [user, setUser] = useState<User | null>(null);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [fullName, setFullName] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                if (error) {
                    console.error("Error fetching user:", error);
                }
                setUser(user);
            } catch (err) {
                console.error("Exception fetching user:", err);
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (userProfile) {
            setFullName(userProfile.fullName || '');
        }
    }, [userProfile]);

    const handleProfileSave = async () => {
        if (!fullName.trim()) {
            alert("Full name cannot be empty.");
            return;
        }
        setIsSavingProfile(true);
        await updateUserProfile({ fullName });
        setIsSavingProfile(false);
        setIsEditingProfile(false);
    };

    const handleEditCancel = () => {
        setFullName(userProfile?.fullName || '');
        setIsEditingProfile(false);
    };

    const formatDate = (dateString: string | undefined | null) => {
        if (!dateString) return 'Not set';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
            });
        } catch (e) {
            return 'Invalid Date';
        }
    };
    
    let planNameText = 'Loading...';
    const isPaid = userProfile?.planStatus === 'paid';

    if (userProfile) {
        if (isPaid) {
            planNameText = 'Standard';
        } else {
            planNameText = isSubscriptionExpired ? 'Expired' : 'Free Trial';
        }
    }

    const stripeCheckoutUrl = useMemo(() => {
        if (!userProfile) return '#';
        return getStripeCheckoutUrl(userProfile.id, user?.email || '');
    }, [userProfile, user]);

    return (
        <div className="text-slate-800">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-10">Account Settings</h1>
            
            <div className="space-y-8 max-w-5xl mx-auto">
                {/* Profile Section */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-8 shadow-sm">
                    {isEditingProfile ? (
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 mb-4">Edit Profile</h2>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                                    <input
                                        id="fullName"
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                                        placeholder="Your full name"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button onClick={handleEditCancel} className="bg-white border border-slate-300 text-slate-700 px-4 py-1.5 text-sm rounded-md font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
                                    <button onClick={handleProfileSave} disabled={isSavingProfile} className="bg-slate-800 text-white px-4 py-1.5 text-sm rounded-md font-semibold hover:bg-slate-900 transition-colors disabled:bg-slate-400">
                                        {isSavingProfile ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-semibold text-slate-900">Your Profile</h2>
                                <button onClick={() => setIsEditingProfile(true)} className="bg-white border border-slate-300 text-slate-700 px-4 py-1.5 text-sm rounded-md font-semibold hover:bg-slate-50 transition-colors">Edit</button>
                            </div>
                            <div className="mt-4 space-y-3 text-sm">
                                <div className="flex flex-col sm:flex-row"><span className="sm:w-32 text-slate-500">Full Name</span><span className="text-slate-800 font-medium">{userProfile?.fullName || 'Not set'}</span></div>
                                <div className="flex flex-col sm:flex-row"><span className="sm:w-32 text-slate-500">Email Address</span><span className="text-slate-800 font-medium">{user?.email}</span></div>
                            </div>
                        </>
                    )}
                </div>

                {/* Subscription Section */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-8 shadow-sm">
                    <h2 className="text-xl font-semibold text-slate-900">Subscription & Billing</h2>
                    
                    {isSubscriptionExpired ? (
                        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
                            <h3 className="text-xl font-bold text-amber-800 mb-2">Subscription Expired</h3>
                            <p className="text-amber-700 mb-6">Your subscription has ended. Reactivate your plan to regain access to Autorank AI features.</p>
                            <a href={stripeCheckoutUrl} target="_blank" rel="noopener noreferrer" className="inline-block bg-orange-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-orange-700 transition-colors shadow-md">Reactivate Subscription</a>
                        </div>
                    ) : (
                        <>
                            <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center sm:text-left">
                                <div className="lg:col-span-1"><p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Current Status</p><p className="text-2xl font-bold text-green-600">{planNameText}</p></div>
                                {isPaid ? (
                                    <>
                                        <div className="lg:col-span-1"><p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Subscription End</p><p className="text-xl font-bold text-slate-900">{formatDate(userProfile?.subscriptionEndDate)}</p></div>
                                        <div className="lg:col-span-1"><p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Credits Used</p><p className="text-xl font-bold text-slate-900">{(30 - (userProfile?.creditsRemaining ?? 0))} / 30</p></div>
                                        <div className="lg:col-span-1"><p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Remaining</p><p className="text-xl font-bold text-orange-600">{userProfile?.creditsRemaining ?? 0}</p></div>
                                    </>
                                ) : (
                                     <>
                                        <div className="lg:col-span-1"><p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Trial Articles</p><p className="text-xl font-bold text-slate-900">{userProfile?.trialArticlesCreated ?? 0} / 3</p></div>
                                        <div className="lg:col-span-2"><p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Trial Ends</p><p className="text-xl font-bold text-slate-900">{formatDate(userProfile?.trialEndDate)}</p></div>
                                     </>
                                )}
                            </div>

                            {!isPaid && (
                                <div className="mt-12">
                                    <div className="text-center mb-8">
                                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Upgrade to Unlock Full Potential</h3>
                                        <p className="text-slate-500">Subscribe to our standard plan to automate your content strategy.</p>
                                        <p className="text-sm text-slate-600 font-medium mt-3">
                                          
                                            Contact <a href="mailto:support@ntxwd.com" className="text-orange-600 font-bold hover:underline">support@ntxwd.com</a> for special pricing!
                                        </p>
                                    </div>

                                    <div className="flex justify-center">
                                        <div className="bg-white border-2 border-orange-400 rounded-2xl p-8 shadow-xl relative w-full max-w-md flex flex-col transition-all transform hover:scale-[1.02]">
                                            <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[11px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
                                                Recommended Plan
                                            </div>
                                            
                                            <h3 className="text-2xl font-black text-slate-900">Standard Plan</h3>
                                            <p className="text-slate-500 text-sm mt-1">30 GEO articles published per month on autopilot.</p>
                                            
                                            <div className="my-8">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-5xl font-black text-slate-900">$499</span>
                                                    <span className="text-slate-500 font-bold">/ month</span>
                                                </div>
                                            </div>
                                            
                                            <ul className="space-y-4 mb-10">
                                                <PlanFeature text="30 AI Articles / Month" />
                                                <PlanFeature text="Strategic Competitor Intelligence" />
                                                <PlanFeature text="Automated Internal Linking" />
                                                <PlanFeature text="Daily Scheduling & Publishing" />
                                                <PlanFeature text="Direct WordPress Sync" />
                                                <PlanFeature text="AI Customer Support Assistant" />
                                            </ul>

                                            <a 
                                                href={stripeCheckoutUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full py-4 rounded-xl font-black transition-all text-center bg-slate-900 text-white shadow-xl hover:bg-slate-800 hover:shadow-orange-500/20 active:scale-[0.98]"
                                            >
                                                Subscribe Now
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isPaid && (
                                <div className="mt-8 flex justify-center">
                                     <a 
                                        href="https://billing.stripe.com/p/login/6oUaEYaKcaYu6NC7nddfG00"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full max-w-sm py-3 rounded-lg font-semibold transition-colors text-center bg-gradient-to-r from-orange-400 to-pink-500 text-white shadow-md hover:from-orange-500 hover:to-pink-600"
                                    >
                                        Manage Your Subscription
                                    </a>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
