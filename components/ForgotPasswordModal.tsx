import React, { useState } from 'react';
import { Modal } from './Modal.tsx';
import { supabase } from '../services/supabaseClient.ts';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // FIX: Added missing 'success' state variable.
  const [success, setSuccess] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    setSuccess(false);

    // Ensure the redirect URL is exactly our current origin to trigger the PKCE exchange
    const redirectTo = window.location.origin;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
        setError("Could not connect to the authentication server. Please check your internet connection or ensure the Supabase project is active.");
      } else {
        setError(error.message);
      }
    } else {
      setMessage('Check your email for a secure sign-in link. This link will be active for 10 minutes.');
      setSuccess(true);
    }
    setLoading(false);
  };

  const handleClose = () => {
    setEmail('');
    setMessage('');
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Sign In Via Email Link">
      <form onSubmit={handlePasswordReset}>
        <div className="space-y-4">
          <p className="text-stone-600">
            Enter your email address and we'll send you a secure link to access your account.
          </p>
          
          <div>
            <label htmlFor="reset-email" className="block text-sm font-medium text-stone-700 mb-1.5">Email Address</label>
            <input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 text-stone-800 placeholder-stone-400 bg-stone-50 border border-stone-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              placeholder="you@example.com"
              autoFocus
            />
          </div>

          {message && (
            <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100 flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {message}
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-semibold text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading || !email.trim() || success}
            className="px-6 py-2 bg-stone-900 text-white text-sm font-bold rounded-lg hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-500 transition-all disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
