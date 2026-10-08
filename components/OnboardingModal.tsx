import React, { useState } from 'react';
import { BusinessInfo } from '../types.ts';
import { LogoIcon } from './icons/LogoIcon.tsx';
import { InputField } from './common/InputField.tsx';
import { TextareaField } from './common/TextareaField.tsx';

interface OnboardingModalProps {
  onComplete: (info: Omit<BusinessInfo, 'id'>) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [formData, setFormData] = useState<Omit<BusinessInfo, 'id'>>({
    url: '',
    name: '',
    description: '',
    audience: '',
    competitors: [],
    // FIX: Corrected property from auto_schedule to autoSchedule to match BusinessInfo type.
    autoSchedule: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const isFormFilled = formData.name && formData.url && formData.description && formData.audience;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormFilled) {
      onComplete(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200/80 transform transition-all animate-fade-in-up">
        <form onSubmit={handleSubmit} className="p-10">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                <LogoIcon className="w-6 h-6" />
            </div>
            <h1 className="ml-4 text-2xl font-bold text-slate-900">Welcome to Autorank AI</h1>
          </div>
          
          <p className="text-slate-600 mb-8">Let's get your content strategy started in 2 minutes. First, tell us about your business.</p>
          
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InputField label="Business Name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., Acme Inc." required />
              <InputField label="Business URL" name="url" type="url" value={formData.url} onChange={handleChange} placeholder="https://example.com" required />
            </div>
            <TextareaField label="Short Business Description" name="description" value={formData.description} onChange={handleChange} placeholder="What you do, for whom." required />
            <InputField label="Target Audience" name="audience" value={formData.audience} onChange={handleChange} placeholder="e.g., Startup founders, hobbyist gardeners" required />
          </div>
          
          <div className="flex justify-end mt-8">
            <button type="submit" disabled={!isFormFilled} className="bg-slate-700 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md">
              Next Step
            </button>
          </div>
        </form>
      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
