import React from 'react';

interface InputFieldProps {
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: string;
    description?: string;
    required?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({ label, name, value, onChange, placeholder, type = "text", description, required = false }) => (
    <div>
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">{label}</label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-white dark:bg-stone-700 border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            autoComplete={name === 'application_password' ? 'new-password' : 'off'}
            required={required}
        />
        {description && <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">{description}</p>}
    </div>
);