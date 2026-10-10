import React from 'react';

interface TextareaFieldProps {
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    rows?: number;
    required?: boolean;
}

export const TextareaField: React.FC<TextareaFieldProps> = ({ label, name, value, onChange, placeholder, rows = 3, required = false }) => (
     <div>
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">{label}</label>
        <textarea
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={rows}
            required={required}
            className="w-full bg-white dark:bg-stone-700 border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
        />
    </div>
);