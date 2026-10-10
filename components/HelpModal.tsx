import React from 'react';
import { Modal } from './Modal.tsx';
import { KeywordIcon } from './icons/KeywordIcon.tsx';
import { BrainCircuitIcon } from './icons/BrainCircuitIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { LinkIcon } from './icons/LinkIcon.tsx';
import { SettingsIcon } from './icons/SettingsIcon.tsx';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpSection: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="mb-8 last:mb-0">
        <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center text-stone-600 mr-3">
                {icon}
            </div>
            <h3 className="text-xl font-semibold text-stone-900">{title}</h3>
        </div>
        <div className="prose prose-slate max-w-none prose-sm sm:prose-base">
            {children}
        </div>
    </div>
);

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="How to Use Autorank AI">
        <div className="p-2">
            <HelpSection icon={<SettingsIcon className="w-5 h-5" />} title="1. Getting Started: Business Settings">
                <p>
                    Everything starts with your business profile. The AI uses this information to generate relevant keywords and write content that matches your brand voice.
                </p>
                <ul>
                    <li><strong>Business Profile:</strong> Fill out your business name, URL, description, and target audience. The more detail you provide, the better the AI's output will be.</li>
                    <li><strong>Competitor Analysis:</strong> Add your top competitors' URLs and run the "Analyze Competitors" feature. This generates an AI Intelligence Report with strategic recommendations that will guide your keyword generation.</li>
                    <li><strong>Automation:</strong> Ensure the "Master Auto-Schedule" is ON. This enables the system to automatically generate and publish content for scheduled keywords, as well as publish any saved drafts on their scheduled dates.</li>
                </ul>
            </HelpSection>

            <HelpSection icon={<KeywordIcon className="w-5 h-5" />} title="2. The Keyword Planner">
                <p>
                    This is your command center for content strategy.
                </p>
                <ul>
                    <li><strong>Generate Ideas:</strong> Click "Generate Ideas" or "Generate with AI Insights" to get a list of recommended keywords tailored to your business.</li>
                    <li><strong>Content Plan:</strong> Move keywords you like from the "Recommended" list to your "Content Plan" by clicking "Add to Plan". This adds keywords to your 'Content Plan', making them ready for you to generate, review, and schedule.</li>
                    <li><strong>Suggest Cluster:</strong> Use the "Suggest Cluster" button to let the AI group related keywords into a strategic pillar-and-cluster model to build topical authority.</li>
                </ul>
            </HelpSection>

            <HelpSection icon={<CalendarIcon className="w-5 h-5" />} title="3. The Calendar: Manual vs. Automated Publishing">
                <p>
                    The calendar is where you manage your publishing schedule. You have two main workflows: a hands-on review process or a fully automated "set it and forget it" approach.
                </p>
                <ul>
                    <li><strong>Manual Review (Recommended):</strong> Manually generate articles from the Keyword Planner before their scheduled date. This saves them as a draft, allowing you to review, edit, and perfect the content. On the scheduled day, the system will publish your approved draft.</li>
                    <li><strong>Automated Workflow (Hands-Off):</strong> If you want to be hands-off, use the "Autofill" buttons to schedule all your keywords. From that point on, the system will automatically generate a new article and publish it each day for you. This is the ultimate "set it and forget it" approach.</li>
                    <li><strong>Drag & Drop:</strong> You can easily reschedule any post (whether it's a generated draft or just a scheduled keyword) by dragging it from one date and dropping it onto another.</li>
                </ul>
            </HelpSection>

            <HelpSection icon={<SparklesIcon className="w-5 h-5" />} title="4. The Article Generation & Review Process">
                <p>
                    <strong>To ensure the highest quality content that truly reflects your brand's expertise, we recommend dedicating a couple of hours each month to this step.</strong> This is where you partner with the AI to create the best possible articles. You can access the editor by clicking on a keyword in the Planner or a post in the Calendar.
                </p>
                <ul>
                    <li><strong>Generate:</strong> Click "Generate Article with AI" from the Keyword Planner or an unscheduled post. This single click will write the text, create images, analyze it for SEO, and generate metadata, saving it as a draft.</li>
                    <li><strong>Review & Edit:</strong> This is the most important step. Read through the generated article. Does it match your brand's voice? Is it factually accurate? Click "Edit Article" to make manual changes and add your unique expertise.</li>
                    <li><strong>Rewrite with AI:</strong> Use the "Rewrite with AI" button to improve the article based on the AI's suggestions or your own advanced instructions.</li>
                    <li><strong>Save as Draft:</strong> Once you are happy with the article, it is saved as a draft and is ready for its scheduled publishing date.</li>
                </ul>
            </HelpSection>

            <HelpSection icon={<LinkIcon className="w-5 h-5" />} title="5. Publishing">
                <p>
                    Once your drafts are reviewed and ready, the system takes over.
                </p>
                <ul>
                    <li><strong>CMS Integration:</strong> Go to the "CMS Integrations" tab and connect your WordPress site using an Application Password. Instructions are provided on that page.</li>
                    <li><strong>Automated Publishing:</strong> As long as the "Master Auto-Schedule" is on, the system will automatically publish any saved draft on its scheduled date. No further action is needed from you.</li>
                    <li><strong>Manual Publishing:</strong> You can also publish an article immediately by opening it in the editor and clicking the "Publish Article" button.</li>
                </ul>
            </HelpSection>
        </div>
    </Modal>
  );
};