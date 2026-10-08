import { useState, useEffect, Dispatch, SetStateAction } from 'react';

function getValue<T,>(key: string, initialValue: T | (() => T)) {
  const savedValue = localStorage.getItem(key);
  if (savedValue) {
    try {
        return JSON.parse(savedValue);
    } catch (error) {
        console.error('Error parsing JSON from localStorage', error);
        return initialValue instanceof Function ? initialValue() : initialValue;
    }
  }
  return initialValue instanceof Function ? initialValue() : initialValue;
}

// FIX: Corrected the return type to use Dispatch<SetStateAction<T>> and updated imports to resolve the 'React' namespace error.
export function useLocalStorage<T,>(key: string, initialValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    return getValue(key, initialValue);
  });

  // This effect ensures that if the key changes (e.g., user logs in),
  // we re-read the value from localStorage to update the state.
  useEffect(() => {
    setValue(getValue(key, initialValue));
  }, [key]);

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
