import React from 'react';
import { PersonalizedPlanData, BusinessInfo, FAQItem } from '../types.ts';
import { Accordion } from './Accordion.tsx';

import { GoogleIcon } from './icons/GoogleIcon.tsx';
import { ChatGptIcon } from './icons/ChatGptIcon.tsx';
import { GeminiIcon } from './icons/GeminiIcon.tsx';
import { ClaudeIcon } from './icons/ClaudeIcon.tsx';
import { PerplexityIcon } from './icons/PerplexityIcon.tsx';
import { GrokIcon } from './icons/GrokIcon.tsx';
import { BingIcon } from './icons/BingIcon.tsx';
import { FoundationIcon } from './icons/FoundationIcon.tsx';
import { GrowthIcon } from './icons/GrowthIcon.tsx';
import { ScaleIcon } from './icons/ScaleIcon.tsx';

interface PersonalizedPlanProps {
    planData: PersonalizedPlanData;
    businessInfo: BusinessInfo;
    postStats: {
        published: number;
        scheduled: number;
        generated: number;
        queued: number;
    };
}

const StatCard: React.FC<{ value: string; label: string; description: string }> = ({ value, label, description }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
        <p className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">{value}</p>
        <h3 className="text-base font-semibold text-slate-800 mt-2">{label}</h3>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
    </div>
);

const PhaseCard: React.FC<{ icon: React.ReactNode, title: string, duration: string, children: React.ReactNode }> = ({ icon, title, duration, children }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm flex flex-col">
        <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                {icon}
            </div>
            <div>
                <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
                <p className="text-sm text-slate-500">{duration}</p>
            </div>
        </div>
        <div className="text-sm text-slate-600 space-y-4 flex-grow">
            {children}
        </div>
    </div>
)

const ProgressBar: React.FC<{ percentage: number }> = ({ percentage }) => (
    <div className="w-full bg-slate-200 rounded-full h-2.5">
        <div className="bg-orange-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
    </div>
);

export const PersonalizedPlan: React.FC<PersonalizedPlanProps> = ({ planData, businessInfo, postStats }) => {
    
    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
        if (num >= 1000) return (num / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'K';
        return num.toLocaleString('en-US');
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    const totalArticles = planData.keywordOpportunitiesFound > 0 ? planData.keywordOpportunitiesFound : 1;
    const progressPercentage = Math.min(100, Math.max(1, (postStats.published / totalArticles) * 100));


    const aiPlatforms = [
        { icon: <GoogleIcon className="w-6 h-6"/>, name: "Google" },
        { icon: <ChatGptIcon className="w-6 h-6"/>, name: "ChatGPT" },
        { icon: <ClaudeIcon className="w-6 h-6"/>, name: "Claude" },
        { icon: <GeminiIcon className="w-6 h-6"/>, name: "Gemini" },
        { icon: <PerplexityIcon className="w-6 h-6"/>, name: "Perplexity" },
        { icon: <GrokIcon className="w-6 h-6"/>, name: "Grok" },
        { icon: <BingIcon className="w-6 h-6"/>, name: "Bing" },
    ];

    const faqs: FAQItem[] = [
        {
            question: "When will I see results?",
            answer: "AI search engines (ChatGPT, Claude) start citing your content within weeks. For Google traffic, you'll see impressions in month 1, and real steady traffic growth around months 3-4. By then, search engines have indexed your content and you can start optimizing what works."
        },
        {
            question: "Does AI-generated content actually rank on Google?",
            answer: "Yes. Google has confirmed they don't penalize AI content - they care about quality and helpfulness. Our AI is trained to create comprehensive, well-structured articles that follow SEO best practices. Plus, you can edit any article to add your unique expertise and personal touches."
        },
        {
            question: "How do I get traffic from ChatGPT, Claude, and other AI search engines?",
            answer: "Your articles become source material for AI responses. When users ask questions in ChatGPT or Claude, these AI engines scan the Google search results and deep web and cite helpful content like your articles. The best part? You don't need to rank #1 on Google to get AI mentions. If your content is highly ranked on Google, you'll get even more AI citations. Articles are the foundation for both traditional and AI search."
        },
        {
            question: "What do I need to do to achieve these results?",
            answer: "Autorank AI handles everything: keyword research, content generation, SEO optimization, and publishing. Your only job is to connect your publishing integration, add keywords to your calendar, and forget about it. Come back after a few months to see results. That's it."
        },
        {
            question: "Why do articles include competitor mentions?",
            answer: "Articles that compare multiple options rank 3-5x better because they match what people actually search for (\"best X tools\" not \"buy your product\"). We focus on getting traffic first with comprehensive content, then you can optimize high-performers to emphasize your offering. Articles mentioning only your products typically get zero traffic because they don't match search intent. Traffic first, conversions second."
        },
        {
            question: "What if my niche is very competitive?",
            answer: "Competitive niches usually take longer on Google, but AI search engines level the playing field by citing helpful content regardless of domain authority. Publishing consistently on long-tail keywords helps you gain traction on both fronts. Even in tough markets, progress comes with steady output."
        },
        {
            question: "Do I need to be an SEO expert?",
            answer: "No. Autorank AI is designed for business owners, not SEOs. The AI handles all the technical SEO aspects of content creation, from keyword research to structuring the article for search engines. You just focus on your business."
        },
        {
            question: "What if I want to pause or cancel?",
            answer: "You can pause or cancel your subscription at any time. If you pause, we'll stop publishing new articles but your existing content will remain live on your site. If you cancel, the same applies - you own all the content we've published for you."
        }
    ];
    
    return (
        <div className="space-y-12">
            {/* Section 1: Personalized Plan */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Personalized Plan</h1>
                <p className="mt-2 text-lg text-slate-600">Your business personalized plan to help you achieve consistent organic traffic growth.</p>
                
                <div className="mt-6 bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
                    <h2 className="text-xl font-semibold text-slate-900">{businessInfo.name}</h2>
                    <a href={businessInfo.url} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline break-all text-sm">{businessInfo.url}</a>
                    <p className="mt-3 text-slate-600 text-sm">{businessInfo.description}</p>
                    <p className="mt-4 text-xs text-slate-400">Plan generated: {formatDate(new Date())}</p>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard value={planData.keywordOpportunitiesFound.toLocaleString()} label="Keyword Opportunities" description="Total articles in your strategic plan" />
                    <StatCard value={formatNumber(planData.monthlySearchVolume)} label="Est. Monthly Search Volume" description="Potential audience for your keywords" />
                    <StatCard value={`$${formatNumber(planData.totalMarketAdValue)}`} label="Est. Monthly Ad Value" description="Equivalent cost if using paid ads" />
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
                <h3 className="font-semibold text-slate-800">Current Plan Progress ({progressPercentage.toFixed(0)}%)</h3>
                <div className="flex items-center gap-4 mt-3">
                     <div className="flex-1">
                        <ProgressBar percentage={progressPercentage} />
                     </div>
                     <div className="text-xs text-slate-500">
                         <span className="font-semibold text-slate-700">{postStats.published.toLocaleString()}</span> of <span className="font-semibold text-slate-700">{planData.keywordOpportunitiesFound.toLocaleString()}</span> articles published
                     </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                    <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>Published ({postStats.published})</span>
                    <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-orange-500 mr-1.5"></span>Scheduled ({postStats.scheduled})</span>
                    <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-indigo-500 mr-1.5"></span>Generated ({postStats.generated})</span>
                    <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5"></span>Queued ({postStats.queued})</span>
                </div>
            </div>

            {/* Section 2: Growth Potential */}
             <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Your Growth Potential</h2>
                <p className="text-slate-600">Your <span className="font-semibold">{planData.keywordOpportunitiesFound.toLocaleString()}</span> keywords represent <span className="font-semibold">{formatNumber(planData.monthlySearchVolume)}</span> monthly searches worth <span className="font-semibold">${formatNumber(planData.totalMarketAdValue)}</span> in total advertising spend. We've projected your first year of growth starting from today, based on typical SEO results with consistent daily publishing (~30 articles per month). If you reach 1% of this market, that's the equivalent of <span className="font-semibold">${(planData.totalMarketAdValue * 0.01).toLocaleString('en-US', { maximumFractionDigits: 0 })}/month</span> in free traffic compared to paying for ads.</p>
            </div>

            {/* Section 3: Optimized for Reach */}
            <div className="text-center bg-white p-8 rounded-xl border border-slate-200/80 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900">Optimized for Maximum Reach</h2>
                <p className="mt-2 text-slate-600 max-w-2xl mx-auto">Your content plan and Autorank AI's AI are designed to capture traffic from all major sources</p>
                <div className="mt-6 flex justify-center items-center flex-wrap gap-x-6 gap-y-4">
                    {aiPlatforms.map(platform => (
                        <div key={platform.name} className="flex flex-col items-center gap-2 text-slate-500">
                           {platform.icon}
                           <span className="text-xs font-medium">{platform.name}</span>
                        </div>
                    ))}
                </div>
                 <p className="text-xs text-slate-400 mt-6">Our generated content ranks across search engines and AI platforms.</p>
            </div>

            {/* Section 4: Growth Phases */}
            <div>
                 <h2 className="text-2xl font-bold text-slate-900 mb-2">Your Growth Phases</h2>
                 <p className="text-slate-600 mb-6">We'll publish articles daily targeting your {planData.keywordOpportunitiesFound.toLocaleString()} tracked keywords. After the first month, you'll start seeing impressions climbing and maybe a few clicks as search engines begin indexing your content. This is the foundation phase where pages get indexed and evaluated. Focus on consistency, not perfection. Don't worry about editing articles until traffic picks up - before that, just keep publishing. Real traffic growth typically starts around months 3-4, when you can optimize what's working.</p>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <PhaseCard icon={<FoundationIcon className="w-5 h-5" />} title="Foundation Phase" duration="Months 1-3">
                        <p>Your website starts building its foundation with consistent daily publishing. Search engines begin indexing your articles, impressions start showing up, and you'll see early clicks from different search engines.</p>
                        <div>
                            <p className="font-semibold text-slate-800 mb-1">Key Milestones:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Publish 90 articles total (30 per month)</li>
                                <li>Google indexing begins and impressions appear</li>
                                <li>First long-tail keywords start ranking</li>
                                <li>Early ChatGPT and Bing traffic appears</li>
                            </ul>
                        </div>
                        <p><span className="font-semibold text-slate-800">Expected:</span> 234-489 monthly visitors</p>
                    </PhaseCard>
                    <PhaseCard icon={<GrowthIcon className="w-5 h-5" />} title="Growth Phase" duration="Months 3-6">
                        <p>Your website starts to grow with 180 articles building real momentum. You begin seeing which search channels bring the most traffic, impressions and clicks increase consistently across multiple articles.</p>
                         <div>
                            <p className="font-semibold text-slate-800 mb-1">Key Milestones:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>180 articles published (content authority)</li>
                                <li>Domain authority significantly improves</li>
                                <li>Mid-tail keywords ranking consistently</li>
                                <li>AI platforms discover and feature content</li>
                            </ul>
                        </div>
                        <p><span className="font-semibold text-slate-800">Expected:</span> 489-2,732 monthly visitors</p>
                    </PhaseCard>
                    <PhaseCard icon={<ScaleIcon className="w-5 h-5" />} title="Scale Phase" duration="Months 6-12">
                        <p>Your website starts competing for higher-volume keywords and more competitive terms. This is when you optimize your highest-performing content and edit articles to add human touches to scale even further.</p>
                         <div>
                            <p className="font-semibold text-slate-800 mb-1">Key Milestones:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>360 articles (complete yearly content plan)</li>
                                <li>High-volume competitive keywords ranking</li>
                                <li>Regularly featured in AI responses</li>
                                <li>Established as industry thought leader</li>
                            </ul>
                        </div>
                        <p><span className="font-semibold text-slate-800">Expected:</span> 2,732-9,976+ monthly visitors</p>
                    </PhaseCard>
                 </div>
            </div>

            {/* Section 5: FAQ */}
            <div>
                 <h2 className="text-2xl font-bold text-slate-900">Frequently Asked Questions</h2>
                 <p className="mt-1 text-slate-600">Everything you need to know about Autorank AI's AI-powered content strategy</p>
                 <div className="mt-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
                    <Accordion items={faqs} />
                 </div>
            </div>
        </div>
    );
};