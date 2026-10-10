import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import { CompetitorAnalysisDisplay } from './CompetitorAnalysisDisplay.tsx';
import { NavSparklesIcon } from './icons/NavIcons.tsx';

export const AIKeywordsIntelligenceTab: React.FC = () => {
    const { selectedBusiness, setActiveTab } = useApp();

    return (
        <div>
            <h1 className="font-serif text-4xl md:text-[44px] leading-none tracking-[-0.01em] text-stone-900">AI Intelligence</h1>
            <p className="mt-1 text-stone-600 mb-8">Strategic insights based on AI-powered analysis of your competitors.</p>

            {selectedBusiness?.competitorAnalysis ? (
                <CompetitorAnalysisDisplay analysis={selectedBusiness.competitorAnalysis} />
            ) : (
                <div className="text-center py-20 bg-white border border-stone-200/80 rounded-xl shadow-sm">
                    <NavSparklesIcon className="w-12 h-12 mx-auto text-stone-300 mb-4" />
                    <h2 className="font-serif text-[26px] leading-tight text-stone-900">No Analysis Found</h2>
                    <p className="text-stone-500 mt-2 mb-6 max-w-md mx-auto">
                        Run a competitive analysis from the Business profile tab to generate your strategic report.
                    </p>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className="bg-stone-800 text-white hover:bg-stone-900 px-6 py-2.5 rounded-lg font-semibold flex items-center justify-center transition-colors shadow-sm mx-auto"
                    >
                        Go to Business profile
                    </button>
                </div>
            )}
        </div>
    );
};