import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { supabase } from '../services/supabaseClient.ts';
import { getStripeTrialUrl } from '../utils/stripe.ts';
import { LogoMark } from './icons/LogoMark.tsx';
import { NavArrowUpRightIcon } from './icons/NavIcons.tsx';

const Check = () => (
    <svg className="w-4 h-4 mt-[3px] text-stone-900 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

/**
 * Shown to a new trial until it has a card on file. Checkout opens in a new tab; this tab checks the profile
 * when it regains focus (and every few seconds after checkout was opened) and moves on once Stripe's webhook
 * has linked the customer.
 */
export const StartTrialScreen: React.FC = () => {
    const { userProfile, refreshProfile } = useApp();
    const [opened, setOpened] = useState(false);

    useEffect(() => {
        const check = () => { if (document.visibilityState === 'visible') refreshProfile(); };
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', check);
        const timer = opened ? window.setInterval(check, 4000) : undefined;
        return () => {
            window.removeEventListener('focus', check);
            document.removeEventListener('visibilitychange', check);
            if (timer) window.clearInterval(timer);
        };
    }, [opened, refreshProfile]);

    const url = userProfile ? getStripeTrialUrl(userProfile.id, userProfile.email || '') : '#';

    return (
        <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-[460px]">
                <div className="flex items-center gap-2.5 mb-6">
                    <LogoMark className="w-7 h-7" />
                    <span className="text-[17px] font-semibold tracking-tight text-stone-900">autorank</span>
                </div>
                <div className="bg-white rounded-2xl border border-[#E7E4DC] shadow-[0_1px_2px_rgba(28,27,25,0.04),0_8px_24px_rgba(28,27,25,0.05)] p-7">
                    <h1 className="font-serif text-[38px] leading-[1.05] text-stone-900">Start your 5-day free trial</h1>
                    <p className="mt-2 text-[15px] text-stone-600">Add a card to get started. You won't be charged today.</p>
                    <ul className="mt-5 space-y-2.5 text-[14px] text-stone-700">
                        <li className="flex gap-2.5"><Check />3 articles researched, written and published for you</li>
                        <li className="flex gap-2.5"><Check />Keyword plan and competitor report included</li>
                        <li className="flex gap-2.5"><Check />$0 today, then $97/month after 5 days</li>
                        <li className="flex gap-2.5"><Check />Cancel before the trial ends and you pay nothing</li>
                    </ul>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setOpened(true)}
                        className="mt-7 w-full h-11 rounded-xl bg-stone-900 text-white text-[15px] font-medium flex items-center justify-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_2px_rgba(0,0,0,0.2)] hover:bg-black transition-colors"
                    >
                        Start free trial <NavArrowUpRightIcon className="w-4 h-4" />
                    </a>
                    {opened && (
                        <p className="mt-3 flex items-center justify-center gap-2 text-[13px] text-stone-500" role="status">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                            Waiting for checkout. This page continues on its own once you're done.
                        </p>
                    )}
                    <p className="mt-5 text-xs text-stone-500 leading-relaxed">
                        Checkout is handled by Stripe. Manage or cancel any time from Account settings. Questions? <a href="mailto:support@ntxwd.com" className="text-stone-900 hover:underline">support@ntxwd.com</a>
                    </p>
                </div>
                <button onClick={() => supabase.auth.signOut()} className="mt-4 text-[13px] text-stone-500 hover:text-stone-900">Log out</button>
            </div>
        </div>
    );
};
