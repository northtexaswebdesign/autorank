import React, { createContext, useContext } from 'react';
import { AppContextType } from '../types.ts';

export const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used within AppProvider");
    return context;
};
