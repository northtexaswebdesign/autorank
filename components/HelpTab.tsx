import React from 'react';
import { KeywordIcon } from './icons/KeywordIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { LinkIcon } from './icons/LinkIcon.tsx';
import { SettingsIcon } from './icons/SettingsIcon.tsx';
import { BrainCircuitIcon } from './icons/BrainCircuitIcon.tsx';

interface HelpSectionProps {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
}

const HelpSection: React.FC<HelpSectionProps> = ({ icon, title, children }) => (
    <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm p-8">
        <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 mr-3">
                {icon}
            </div>
            <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
        </div>
        <div className="prose prose-slate max-w-none prose-sm sm:prose-base">
            {children}
        </div>
    </div>
);

export const HelpTab: React.FC = () => {
  return (
    <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Help & Documentation</h1>
        <p className="mt-1 text-slate-600 mb-8">A complete guide to getting the most out of Autorank AI.</p>
        <div className="space-y-6">
            
            <HelpSection icon={<BrainCircuitIcon className="w-5 h-5" />} title="Welcome to Autorank AI: Your Automated GEO Content Platform">
                <p>
                    This guide will walk you through setting up and using Autorank AI to generate a strategic content plan and automate your content marketing.
                </p>
            </HelpSection>

            <HelpSection icon={<BrainCircuitIcon className="w-5 h-5" />} title="Understanding the Power of Autorank AI: More Than Just a Writer">
                <p>
                    Autorank AI isn't just another AI content generator; it's a strategic <strong>Generative Engine Optimization (GEO)</strong> platform. Its core power comes from its direct, live integration with <strong>Google Search</strong> for every critical task.
                </p>
                <ul>
                    <li><strong>Real-Time, Fact-Based Content:</strong> Unlike standard AI models that rely on static, outdated knowledge, our AI actively uses live web search to analyze the current top-ranking articles for any given topic. This ensures every article is grounded in fact-based, authoritative sources, which is critical for establishing E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness).</li>
                    <li><strong>Strategic Keyword & Content Generation:</strong> When our AI generates keywords or writes an article, it doesn't guess. It identifies what's already ranking, finds gaps in your competitors' content, and understands the specific questions users are asking <em>right now</em>. This creates content that is perfectly optimized to answer user intent.</li>
                    <li><strong>Built for AI Search:</strong> This connection to live search data is what allows Autorank AI to create content that is not only ready to rank on Google but is also perfectly structured to be cited as a source by other AI search engines like ChatGPT, Perplexity, and Claude.</li>
                </ul>
            </HelpSection>

            <HelpSection icon={<SettingsIcon className="w-5 h-5" />} title="1. Getting Started: Setting Up for Success">
                <p>
                    Your entire strategy begins in the <strong>Business & Settings</strong> tab. The quality of the information you provide here directly impacts the quality of the AI's output.
                </p>
                <ul>
                    <li><strong>Your Business Profile:</strong> Fill this out in detail. The AI uses your <strong>description</strong> and <strong>target audience</strong> to generate highly relevant keywords and adopt the correct tone of voice in its writing.</li>
                    <li><strong>Automation Switch:</strong> Ensure the "Master Auto-Schedule" is <strong>ON</strong>. This is the master switch that allows the system to automatically generate and publish articles according to your calendar schedule.</li>
                </ul>
            </HelpSection>

             <HelpSection icon={<BrainCircuitIcon className="w-5 h-5" />} title="2. The AI Intelligence Report: Your Strategic Blueprint">
                <p>
                    This is the most critical step for creating a winning strategy. Before generating keywords, go to <strong>Business & Settings</strong>, add your top competitors' URLs, and run the <strong>"Analyze Competitors with AI"</strong> feature.
                </p>
                <ul>
                    <li><strong>What it does:</strong> The AI performs a deep analysis of your competitors' websites, identifying their content strengths, weaknesses, and overall strategy.</li>
                    <li><strong>Why it's important:</strong> The output of this analysis is a set of <strong>Strategic Recommendations</strong> in the <strong>AI Intelligence</strong> tab. These recommendations become the primary instructions for the AI during keyword generation. Instead of generating generic keywords, the AI will now focus on finding topics that exploit your competitors' weaknesses and align with proven strategies in your niche.</li>
                    <li><strong>The Result:</strong> You get a smarter, more targeted keyword plan from day one, giving you a significant competitive advantage.</li>
                </ul>
            </HelpSection>

            <HelpSection icon={<KeywordIcon className="w-5 h-5" />} title="3. The Keyword Planner: Your Content Command Center">
                <p>
                    This is where your content strategy comes to life.
                </p>
                <ul>
                    <li><strong>Generate Ideas:</strong> Click <strong>"Generate with AI Insights"</strong>. The AI will use your business profile and the Strategic Recommendations from your intelligence report to generate a list of high-opportunity keywords. These appear in your "Recommended" list.</li>
                    <li><strong>Build Your Content Plan:</strong> Review the "Recommended" keywords. For every topic you want to target, click <strong>"Add to Plan"</strong>. This moves the keyword to your "Content Plan" list, marking it as an approved topic that's ready for the next step.</li>
                    <li><strong>Build Topical Authority:</strong> Use the <strong>"Suggest Cluster"</strong> button. The AI will analyze your recommended keywords and group them into a strategic pillar-and-cluster model, which is a powerful technique for dominating a niche in search results.</li>
                </ul>
            </HelpSection>

            <HelpSection icon={<CalendarIcon className="w-5 h-5" />} title="4. The Calendar: Automated vs. Manual Workflows">
                <p>
                    The calendar is where you manage your publishing schedule. You have two powerful workflows at your disposal:
                </p>
                <ul>
                    <li><strong>Automated Workflow (Hands-Off):</strong> This is the "set it and forget it" approach. Go to the calendar and click <strong>"Autofill from Content Plan"</strong>. The system will automatically place all your approved keywords onto the calendar, one per day. With the Master Auto-Schedule on, the AI will handle the rest—generating and publishing a new article every day without any further input from you.</li>
                    <li><strong>Manual Review Workflow (Recommended):</strong> For maximum quality control, generate articles <em>before</em> their scheduled date. You can do this from the Keyword Planner or by clicking a post on the calendar. This generates the article and saves it as a <strong>draft</strong>. You can then review, edit, and perfect the content. On its scheduled day, the system will automatically publish your approved draft.</li>
                </ul>
            </HelpSection>

            <HelpSection icon={<SparklesIcon className="w-5 h-5" />} title="5. The Article Editor: Partnering with the AI">
                <p>
                    You can access the editor by generating a new article or clicking on any existing post in the calendar or "Past Articles" tab.
                </p>
                <ul>
                    <li><strong>Generate:</strong> One click handles everything: writing the text, creating three unique images, analyzing the content for its GEO Score, and writing the SEO meta title and description.</li>
                    <li><strong>Review & Edit:</strong> This is where you add the human touch. Read the article. Click <strong>"Edit Article"</strong> to make manual changes, add your unique expertise, and ensure the tone perfectly matches your brand.</li>
                    <li><strong>Rewrite with AI:</strong> Use the suggestions in the sidebar to guide the AI. Provide custom instructions in the "Advanced Instructions" box and click <strong>"Rewrite with AI"</strong> to have it revise the article based on your feedback.</li>
                </ul>
            </HelpSection>

            <HelpSection icon={<LinkIcon className="w-5 h-5" />} title="6. Publishing Your Content">
                 <ul>
                    <li><strong>CMS Integration:</strong> Go to the <strong>"CMS Integrations"</strong> tab and connect your WordPress site using an Application Password. Instructions are provided on that page.</li>
                    <li><strong>Publishing:</strong> If the Master Auto-Schedule is on, any draft will be automatically published on its scheduled date. You can also publish any article immediately by opening it in the editor and clicking the <strong>"Publish Article"</strong> button.</li>
                </ul>
            </HelpSection>

            <div className="text-center pt-4">
                <p className="text-sm text-slate-500">
                    For more detailed instructions and advanced guides, please visit our official <a href="https://autorank-ai.com/help-center/" target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-600 hover:underline">Help Center</a>.
                </p>
            </div>
        </div>
    </div>
  );
};