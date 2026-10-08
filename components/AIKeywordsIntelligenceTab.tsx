import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import { CompetitorAnalysisDisplay } from './CompetitorAnalysisDisplay.tsx';
import { BrainCircuitIcon } from './icons/BrainCircuitIcon.tsx';

export const AIKeywordsIntelligenceTab: React.FC = () => {
    const { selectedBusiness, setActiveTab } = useApp();

    return (
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">AI Intelligence</h1>
            <p className="mt-1 text-slate-600 mb-8">Strategic insights based on AI-powered analysis of your competitors.</p>

            {selectedBusiness?.competitorAnalysis ? (
                <CompetitorAnalysisDisplay analysis={selectedBusiness.competitorAnalysis} />
            ) : (
                <div className="text-center py-20 bg-white border border-slate-200/80 rounded-xl shadow-sm">
                    <BrainCircuitIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h2 className="text-xl font-bold text-slate-700">No Analysis Found</h2>
                    <p className="text-slate-500 mt-2 mb-6 max-w-md mx-auto">
                        Run a competitive analysis from the "Business & Settings" tab to generate your strategic report.
                    </p>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className="bg-slate-800 text-white hover:bg-slate-900 px-6 py-2.5 rounded-lg font-semibold flex items-center justify-center transition-colors shadow-sm mx-auto"
                    >
                        Go to Settings
                    </button>
                </div>
            )}
        </div>
    );
};