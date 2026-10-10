import React, { useState } from 'react';
import { LogoIcon } from './icons/LogoIcon.tsx';
import { supabase } from '../services/supabaseClient.ts';
import { ForgotPasswordModal } from './ForgotPasswordModal.tsx';
import { KeywordIcon } from './icons/KeywordIcon.tsx';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { LinkIcon } from './icons/LinkIcon.tsx';
import { GoogleIcon } from './icons/GoogleIcon.tsx';

const keywords = [
  "how to improve domain authority",
  "long-tail keyword strategy",
  "ai content generation for blogs",
  "link building outreach templates",
  "ecommerce seo best practices",
  "seo content brief example",
  "optimize for google discover",
  "what is generative engine optimization",
  "topical authority seo",
  "how to do a content audit",
  "programmatic seo guide",
  "schema markup for articles",
];

const features = [
    {
        icon: <KeywordIcon className="w-6 h-6 text-brand-400" />,
        title: "Smart Keyword Discovery",
        description: "Find high-opportunity keywords your competitors are missing."
    },
    {
        icon: <SparklesIcon className="w-6 h-6 text-brand-400" />,
        title: "Automated Content Creation",
        description: "Generate high-quality, GEO-optimized articles in seconds."
    },
    {
        icon: <CalendarIcon className="w-6 h-6 text-brand-400" />,
        title: "Automated Publishing",
        description: "Schedule keywords and let the AI write and publish content for you, completely hands-free."
    },
    {
        icon: <LinkIcon className="w-6 h-6 text-brand-400" />,
        title: "Pillar-Cluster Strategy",
        description: "Build topical authority and dominate your niche."
    }
];

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isForgotPassOpen, setIsForgotPassOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      setLoading(false);
      return;
    }

    try {
        if (isLoginView) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } else {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            alert('Check your email for a confirmation link!');
        }
    } catch (error: any) {
        if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
            setError("Login failed: Could not connect to the authentication server. This is often a CORS issue. Please ensure the 'auth-proxy' Supabase Edge Function has been deployed correctly. You can deploy it by running 'supabase functions deploy auth-proxy' from your terminal.");
        } else {
            setError(error.error_description || error.message);
        }
    } finally {
        setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
    } catch (error: any) {
        if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
            setError("Login failed: Could not connect to the authentication server. Please check your internet connection or ensure the Supabase project is active.");
        } else {
            setError(error.message || 'Failed to sign in with Google');
        }
        setLoading(false);
    }
  };

  const toggleView = () => {
    setIsLoginView(!isLoginView);
    setError('');
    setEmail('');
    setPassword('');
  };

  return (
    <>
      <div className="grid md:grid-cols-2 min-h-screen">
        {/* Left Panel */}
        <div className="bg-stone-900 text-white p-12 hidden md:flex flex-col">
            <div className="flex items-center mb-12">
                <div className="w-8 h-8 bg-stone-800 text-white rounded-lg flex items-center justify-center">
                    <LogoIcon className="w-5 h-5" />
                </div>
                <span className="ml-3 text-xl font-bold text-white">Autorank AI</span>
            </div>
            
            <div className="flex-grow flex flex-col justify-center">
                <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight">Grow your organic traffic on autopilot.</h1>
                <p className="mt-4 text-lg text-stone-300">The AI-powered platform for effortless SEO content creation and publishing.</p>

                <div className="relative h-40 mt-10 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]">
                    <div className="animate-scroll-up">
                        {[...keywords, ...keywords].map((keyword, index) => (
                            <div key={index} className="px-5 py-2.5 my-3 rounded-full bg-stone-800/50 border border-stone-700/80 shadow-sm">
                                <p className="text-stone-300">{keyword}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mt-12">
                    {features.map(feature => (
                        <div key={feature.title}>
                            <div className="flex items-center">
                                {feature.icon}
                                <h3 className="ml-3 font-semibold text-stone-100">{feature.title}</h3>
                            </div>
                            <p className="mt-2 text-sm text-stone-400">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            <footer className="text-sm text-stone-500 mt-12">
                &copy; 2026 Autorank AI. All rights reserved.
            </footer>
        </div>

        {/* Right Panel */}
        <div className="bg-stone-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                 <div className="md:hidden text-center mb-8">
                    <div className="inline-flex items-center justify-center mb-4">
                        <div className="w-10 h-10 bg-stone-900 text-white rounded-lg flex items-center justify-center">
                            <LogoIcon className="w-6 h-6" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-stone-900">Autorank AI</h1>
                </div>

                <div className="p-8 space-y-6 bg-white rounded-2xl shadow-lg border border-stone-200/80">
                    <div>
                        <h2 className="text-xl font-bold text-stone-900">
                           {isLoginView ? 'Sign in to your account' : 'Create an Account'}
                        </h2>
                    </div>
                    
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full px-4 py-2.5 text-sm font-semibold text-stone-700 bg-white border border-stone-300 rounded-lg shadow-sm hover:bg-stone-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        <GoogleIcon className="w-5 h-5" />
                        {isLoginView ? 'Sign in with Google' : 'Sign up with Google'}
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-stone-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-stone-500 font-medium">Or continue with email</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                        <label htmlFor="email" className="sr-only">Email Address</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 text-stone-800 placeholder-stone-400 bg-white border border-stone-300 rounded-lg shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
                            placeholder="email@example.com"
                        />
                        </div>

                        <div>
                        <label htmlFor="password" className="sr-only">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete={isLoginView ? "current-password" : "new-password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 text-stone-800 placeholder-stone-400 bg-white border border-stone-300 rounded-lg shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
                            placeholder="Password"
                        />
                        </div>
                        
                        {error && <p className="text-sm text-brand-700">{error}</p>}

                        <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-lg shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all disabled:bg-stone-400"
                        >
                            {loading ? 'Processing...' : (isLoginView ? 'Sign In' : 'Sign Up')}
                        </button>
                        </div>
                    </form>
                    <div className="flex flex-col items-center space-y-2 text-sm">
                        <button onClick={toggleView} className="font-medium text-brand-600 hover:text-brand-500">
                            {isLoginView ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}
                        </button>
                        {isLoginView && (
                            <button 
                                type="button" 
                                onClick={() => setIsForgotPassOpen(true)}
                                className="font-medium text-stone-500 hover:text-stone-700 focus:outline-none"
                            >
                                sign in using email
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>
      <ForgotPasswordModal isOpen={isForgotPassOpen} onClose={() => setIsForgotPassOpen(false)} />
    </>
  );
};
