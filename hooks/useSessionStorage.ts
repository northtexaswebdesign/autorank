import { useState, useEffect, Dispatch, SetStateAction } from 'react';

function getValue<T,>(key: string, initialValue: T | (() => T)) {
  const savedValue = sessionStorage.getItem(key);
  if (savedValue) {
    try {
        return JSON.parse(savedValue);
    } catch (error) {
        console.error('Error parsing JSON from sessionStorage', error);
        return initialValue instanceof Function ? initialValue() : initialValue;
    }
  }
  return initialValue instanceof Function ? initialValue() : initialValue;
}

export function useSessionStorage<T,>(key: string, initialValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    return getValue(key, initialValue);
  });

  // This effect runs when the key changes, to sync state with sessionStorage.
  // This is useful if the hook is used with a dynamic key.
  useEffect(() => {
    setValue(getValue(key, initialValue));
  }, [key]);

  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
