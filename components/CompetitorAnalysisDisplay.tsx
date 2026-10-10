import React from 'react';
import { CompetitorAnalysis } from '../types.ts';
import { NavSparklesIcon, NavArrowUpRightIcon } from './icons/NavIcons.tsx';
import { SimpleMarkdownRenderer } from './common/SimpleMarkdownRenderer.tsx';

interface CompetitorAnalysisDisplayProps {
    analysis: CompetitorAnalysis;
}

const CheckMark = () => (
    <svg className="w-3.5 h-3.5 mr-2 mt-[3px] text-green-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
const GapMark = () => (
    <svg className="w-3.5 h-3.5 mr-2 mt-[3px] text-red-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
);

const hostOf = (url: string) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};

export const CompetitorAnalysisDisplay: React.FC<CompetitorAnalysisDisplayProps> = ({ analysis }) => {
    const analyzedOn = new Date(analysis.analyzedAt).toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });

    return (
        <div className="space-y-8">
            <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center flex-shrink-0">
                    <NavSparklesIcon className="w-[18px] h-[18px]" />
                </span>
                <div>
                    <h2 className="font-serif text-[26px] leading-tight text-stone-900">Competitive intelligence report</h2>
                    <p className="text-xs text-stone-500 mt-1">Last analyzed {analyzedOn}</p>
                </div>
            </div>

            <section aria-labelledby="recs-heading" className="rounded-2xl bg-[#F7F6F3] border border-[#ECE9E2] shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(28,27,25,0.05)] p-5">
                <h3 id="recs-heading" className="font-serif text-[24px] leading-tight text-stone-900 mb-4">Strategic recommendations</h3>
                <ol className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                    {analysis.strategicRecommendations.map((rec, index) => (
                        <li key={index} className="flex gap-3 items-start bg-white border border-[#ECE9E2] rounded-xl p-3">
                            <span className="w-[22px] h-[22px] rounded-md bg-stone-900 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">{index + 1}</span>
                            <SimpleMarkdownRenderer as="span" text={rec} className="text-sm text-stone-800 leading-relaxed" />
                        </li>
                    ))}
                </ol>
            </section>

            <section aria-labelledby="competitors-heading" className="space-y-3">
                <h3 id="competitors-heading" className="font-serif text-[24px] leading-tight text-stone-900">Competitors</h3>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {analysis.analysis.map((report, index) => (
                        <article key={index} className="bg-white border border-[#ECE9E2] rounded-2xl p-5 shadow-[0_1px_2px_rgba(28,27,25,0.05)] flex flex-col gap-3">
                            <a href={report.url} target="_blank" rel="noopener noreferrer" className="group self-start inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-[#DCE6F7] bg-[#F3F7FE] text-xs text-blue-700 hover:border-blue-300 break-all">
                                {hostOf(report.url)}
                                <NavArrowUpRightIcon className="w-3 h-3 flex-shrink-0" />
                            </a>
                            <SimpleMarkdownRenderer as="p" text={report.contentStrategySummary} className="text-sm text-stone-600 leading-relaxed" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 pt-3 border-t border-[#F3F1EC]">
                                <div>
                                    <h4 className="text-xs font-medium text-green-700 mb-2">Strengths</h4>
                                    <ul className="space-y-1.5 text-sm">
                                        {report.strengths.map((item, i) => (
                                            <li key={i} className="flex items-start">
                                                <CheckMark />
                                                <SimpleMarkdownRenderer as="span" text={item} className="text-stone-700" />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="text-xs font-medium text-red-700 mb-2">Gaps you can win</h4>
                                    <ul className="space-y-1.5 text-sm">
                                        {report.weaknesses.map((item, i) => (
                                            <li key={i} className="flex items-start">
                                                <GapMark />
                                                <SimpleMarkdownRenderer as="span" text={item} className="text-stone-700" />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
};
