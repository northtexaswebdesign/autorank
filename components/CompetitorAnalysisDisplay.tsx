import React from 'react';
import { CompetitorAnalysis } from '../types.ts';
import { LightbulbIcon } from './icons/LightbulbIcon.tsx';
import { CheckCircleIcon } from './icons/CheckCircleIcon.tsx';
import { XCircleIcon } from './icons/XCircleIcon.tsx';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { LinkIcon } from './icons/LinkIcon.tsx';
import { SimpleMarkdownRenderer } from './common/SimpleMarkdownRenderer.tsx';

interface CompetitorAnalysisDisplayProps {
    analysis: CompetitorAnalysis;
}

export const CompetitorAnalysisDisplay: React.FC<CompetitorAnalysisDisplayProps> = ({ analysis }) => {
    
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    return (
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm p-8 space-y-8">
            <div>
                <h2 className="text-xl font-semibold text-slate-900 flex items-center">
                    <SparklesIcon className="w-6 h-6 mr-3 text-orange-500" />
                    AI Competitive Intelligence Report
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Last analyzed on: {formatDate(analysis.analyzedAt)}
                </p>
            </div>
            
            <div className="space-y-6">
                {analysis.analysis.map((report, index) => (
                    <div key={index} className="bg-slate-50 border border-slate-200/80 rounded-lg p-6">
                        <a href={report.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-800 hover:text-orange-600 hover:underline flex items-center text-lg break-all">
                            {report.url}
                            <LinkIcon className="w-4 h-4 ml-2 flex-shrink-0" />
                        </a>
                        <SimpleMarkdownRenderer as="p" text={report.contentStrategySummary} className="text-sm text-slate-600 mt-2 mb-4" />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <div>
                                <h4 className="font-semibold text-slate-700 mb-2">Strengths</h4>
                                <ul className="space-y-1.5 text-sm">
                                    {report.strengths.map((item, i) => (
                                        <li key={i} className="flex items-start">
                                            <CheckCircleIcon className="w-5 h-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                                            <SimpleMarkdownRenderer as="span" text={item} className="text-slate-700" />
                                        </li>
                                    ))}
                                </ul>
                            </div>
                             <div>
                                <h4 className="font-semibold text-slate-700 mb-2">Weaknesses</h4>
                                <ul className="space-y-1.5 text-sm">
                                    {report.weaknesses.map((item, i) => (
                                        <li key={i} className="flex items-start">
                                            <XCircleIcon className="w-5 h-5 mr-2 text-red-500 flex-shrink-0 mt-0.5" />
                                            <SimpleMarkdownRenderer as="span" text={item} className="text-slate-700" />
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div>
                 <h3 className="text-lg font-semibold text-slate-900 flex items-center mb-3">
                    <LightbulbIcon className="w-5 h-5 mr-2 text-slate-500" />
                    Strategic Recommendations
                </h3>
                <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside">
                    {analysis.strategicRecommendations.map((rec, index) => (
                        <SimpleMarkdownRenderer key={index} as="li" text={rec} />
                    ))}
                </ul>
            </div>
        </div>
    );
};
