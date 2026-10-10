import React from 'react';
import {
  NavBusinessIcon, NavSparklesIcon, NavSearchIcon, NavCalendarIcon, NavArticleIcon,
  NavPlugIcon, NavHelpIcon, NavUserIcon, NavArrowUpRightIcon, NavPlusIcon, NavDashboardIcon,
} from './icons/NavIcons.tsx';

/** A button or label as it appears in the app. */
const Ui: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center h-[22px] px-1.5 mx-0.5 rounded-md bg-[#F7F6F3] border border-[#ECE9E2] text-[13px] font-medium text-stone-900 whitespace-nowrap align-[1px]">{children}</span>
);

const Points: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul className="mt-3 space-y-2.5">{children}</ul>
);
const Point: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <li className="flex gap-3 text-[14px] leading-relaxed text-stone-600">
    <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-stone-300 flex-shrink-0" aria-hidden="true" />
    <span>{title && <strong className="font-semibold text-stone-900">{title} </strong>}{children}</span>
  </li>
);

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mt-4 rounded-xl bg-[#F7F6F3] border border-[#ECE9E2] px-4 py-3 text-[13px] leading-relaxed text-stone-600">{children}</p>
);

const Section: React.FC<{ id: string; icon: React.ReactElement<{ className?: string }>; step?: string; title: string; lead: React.ReactNode; children?: React.ReactNode }> = ({ id, icon, step, title, lead, children }) => (
  <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 bg-white border border-[#ECE9E2] rounded-2xl p-6 shadow-[0_1px_2px_rgba(28,27,25,0.05)]">
    <div className="flex items-start gap-3">
      <span className="w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center flex-shrink-0">
        {React.cloneElement(icon, { className: 'w-[18px] h-[18px]' })}
      </span>
      <div className="min-w-0">
        {step && <div className="text-xs font-medium text-stone-500">{step}</div>}
        <h2 id={`${id}-title`} className="font-serif text-[26px] leading-tight text-stone-900">{title}</h2>
      </div>
    </div>
    <p className="mt-3 text-[15px] leading-relaxed text-stone-700">{lead}</p>
    {children}
  </section>
);

const STEPS = [
  { id: 'setup', icon: <NavBusinessIcon />, label: 'Set up', text: 'Business profile and WordPress' },
  { id: 'intelligence', icon: <NavSparklesIcon />, label: 'Study rivals', text: 'AI competitive report' },
  { id: 'planner', icon: <NavSearchIcon />, label: 'Pick keywords', text: 'Build your content plan' },
  { id: 'calendar', icon: <NavCalendarIcon />, label: 'Schedule', text: 'Autofill the calendar' },
  { id: 'autopublish', icon: <NavPlugIcon />, label: 'Auto-publish', text: 'Written and posted for you' },
];

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Why didn't a post publish?",
    a: <>Check three things: <Ui>Master Auto-Schedule</Ui> is on in Business profile, WordPress is connected in Integrations, and your plan is active. Then look in the Activity log: each failed attempt is logged with the error. After 3 failed attempts the post goes back to draft; fix the problem and publish it from the editor, or drag it to a new date to try again.</>,
  },
  {
    q: 'How do I pause auto-publishing?',
    a: <>Turn off <Ui>Master Auto-Schedule</Ui> in Business profile. Nothing is written or published while it is off, and your calendar stays as it is.</>,
  },
  {
    q: 'Can I change the date of an article?',
    a: <>Yes. Drag the post to another day on the calendar. It keeps its time of day, and if that day already has a post the two swap dates.</>,
  },
  {
    q: 'What does removing a post from the calendar do?',
    a: <>The trash icon on a calendar post deletes the post and puts its keyword back in your Content Plan. This applies to written and published posts too (the article already on WordPress stays there). To delete a written article, use the Articles tab instead.</>,
  },
  {
    q: 'What uses a credit?',
    a: <>Only writing an article: 1 credit on a paid plan, or 1 of your 3 trial articles. Publishing, updating a live article, rewrites, GEO scoring and new cover images don't use credits (rewrites have a daily limit). If writing fails, the credit is given back.</>,
  },
  {
    q: 'Do I have to use the Content Plan?',
    a: <>No. <Ui>Autofill from all keywords</Ui> schedules everything in your Recommended list. The Content Plan is for when you want to approve each topic first.</>,
  },
];

const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export const HelpTab: React.FC = () => {
  return (
    <div>
      <h1 className="font-serif text-4xl md:text-[44px] leading-none tracking-[-0.01em] text-stone-900">Help center</h1>
      <p className="mt-1 text-stone-600 mb-8">How Autorank turns your business into articles that search engines and AI assistants cite, and where to find each step in the app.</p>

      <section aria-label="How Autorank works" className="rounded-2xl bg-[#F7F6F3] border border-[#ECE9E2] shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(28,27,25,0.05)] p-5 mb-6">
        <h2 className="font-serif text-[24px] leading-tight text-stone-900">How Autorank works</h2>
        <p className="mt-1 text-sm text-stone-600">Set it up once, then Autorank researches, writes and publishes on your schedule. Click a step to read about it.</p>
        <ol className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button onClick={() => jumpTo(s.id)} className="w-full h-full text-left bg-white border border-[#ECE9E2] rounded-xl p-3 hover:border-stone-400 transition-colors">
                <span className="flex items-center justify-between text-stone-500">
                  {React.cloneElement(s.icon, { className: 'w-[18px] h-[18px]' })}
                  <span className="text-xs tabular-nums">{i + 1}</span>
                </span>
                <span className="block mt-3 text-sm font-semibold text-stone-900">{s.label}</span>
                <span className="block text-xs text-stone-500 mt-0.5">{s.text}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <div className="space-y-4">
        <Section id="setup" icon={<NavBusinessIcon />} step="Step 1" title="Set up your business"
          lead={<>Everything Autorank writes is based on your <strong className="font-semibold text-stone-900">Business profile</strong>, so the more specific it is, the better the keywords and articles.</>}>
          <Points>
            <Point title="Profile.">Your business name, website, a short description and your target audience. Write the description the way you'd explain the business to a new customer.</Point>
            <Point title="Main competitors.">Up to three competitor websites. They are used for the competitive report (step 2).</Point>
            <Point title="Language and sitemap.">Choose the language articles are written in. Adding your sitemap URL lets Autorank link new articles to your existing pages.</Point>
            <Point title="Master Auto-Schedule.">The on/off switch for automatic writing and publishing. It saves as soon as you flip it. It's off for new businesses, so turn it on when your calendar is ready.</Point>
            <Point title="Cover images.">Every article gets a branded cover. Under <Ui>Brand Style for Cover Images</Ui> set your colors, fonts and logo, or leave it empty and Autorank reads them from your website. Turn on <Ui>Skip Image Generation</Ui> if you only want text.</Point>
            <Point title="Connect WordPress.">In <strong className="font-semibold text-stone-900">Integrations</strong>, enter your site URL, username and an Application Password (WordPress admin → Users → Profile → Application Passwords). Click <Ui>Test</Ui> to check it, then <Ui>Save</Ui>. Without this, nothing can be published.</Point>
          </Points>
          <Note>Click <Ui>Save Settings</Ui> at the bottom of Business profile after changing the profile, language, competitors or brand style.</Note>
        </Section>

        <Section id="intelligence" icon={<NavSparklesIcon />} step="Step 2" title="AI Intelligence: study your competitors"
          lead={<>In Business profile, click <Ui>Analyze Competitors with AI</Ui>. Autorank reads each competitor's site and their search results, then writes a report you'll find in the <strong className="font-semibold text-stone-900">AI Intelligence</strong> tab.</>}>
          <Points>
            <Point title="What's in it.">For each competitor: a summary of their content strategy, their strengths and the gaps you can win. On top, 4–6 strategic recommendations for you.</Point>
            <Point title="How it's used.">From then on, keyword ideas take the recommendations into account, and the planner button changes to <Ui>Generate with AI Insights</Ui>.</Point>
            <Point title="Limit.">One analysis per business per calendar month. If the research fails for every site, the run doesn't count.</Point>
          </Points>
        </Section>

        <Section id="planner" icon={<NavSearchIcon />} step="Step 3" title="Keyword Planner: choose what to write about"
          lead={<>The planner is your list of article topics. The cards at the top (<Ui>All Keywords</Ui>, <Ui>Recommended</Ui>, <Ui>Starred</Ui>, <Ui>Content Plan</Ui>) count your keywords and filter the table.</>}>
          <Points>
            <Point title="Get ideas.">Click <Ui>Generate with AI Insights</Ui> (or <Ui>Generate Ideas</Ui> before you have a report). Autorank checks real search results and adds about 20 keywords to Recommended, each rated High, Medium or Low opportunity. Pick a language first if you want keywords in another language.</Point>
            <Point title="Approve topics.">Click <Ui>Add to Plan</Ui> to move a keyword into your Content Plan, or <Ui>Remove from Plan</Ui> to move it back. Star keywords you want to keep an eye on.</Point>
            <Point title="Add your own.">Use <Ui>Add Keyword</Ui> for a topic you already have in mind.</Point>
            <Point title="Build topic clusters.">Click <Ui>Suggest Cluster</Ui>, type one main keyword and click <Ui>Generate Cluster</Ui>. You get a pillar page and supporting cluster pages; untick any you don't want and click <Ui>Accept &amp; Add to Plan</Ui> (it shows how many). Covering a topic from several angles helps you rank for all of it.</Point>
            <Point title="Write one now.">The <Ui>Generate</Ui> button on a row creates a draft dated today and opens it in the editor, where you click <Ui>Generate Article with AI</Ui>. If you leave it unwritten and auto-publish is on, it's written and published on the next run.</Point>
          </Points>
        </Section>

        <Section id="calendar" icon={<NavCalendarIcon />} step="Step 4" title="Calendar: schedule your articles"
          lead={<>Fill the calendar in one click. <Ui>Autofill from content plan</Ui> schedules your approved keywords; <Ui>Autofill from all keywords</Ui> schedules your whole Recommended list.</>}>
          <Points>
            <Point title="How dates are picked.">One article per day, starting tomorrow at 9:00 your time, skipping days that already have a post. Scheduled keywords leave the planner.</Point>
            <Point title="Reading the calendar.">A blue dot means scheduled (not written yet), grey means written and waiting for its date, a pulsing dot means Autorank is writing it now, and green means published. The bar at the top counts this month's published and scheduled posts.</Point>
            <Point title="Change the plan.">Drag a post to another day; if that day is taken, the two swap. Click a post to open it in the editor, or use the trash icon to take it off the calendar (its keyword goes back to your Content Plan).</Point>
          </Points>
          <Note>Want to review before anything goes live? Open upcoming posts and click <Ui>Generate Article with AI</Ui> ahead of time. Written drafts are published exactly as you left them on their date.</Note>
        </Section>

        <Section id="autopublish" icon={<NavPlugIcon />} step="Step 5" title="Auto-publishing"
          lead={<>With <Ui>Master Auto-Schedule</Ui> on and WordPress connected, Autorank checks your calendar every 2 hours and handles every post whose date has arrived.</>}>
          <Points>
            <Point title="Not written yet?">It's researched and written first (1 credit), then given a GEO score, meta title and description, and a cover image.</Point>
            <Point title="Already a draft?">It's published as you left it.</Point>
            <Point title="On WordPress.">Each article goes out with its featured image, a "Last updated" line and structured data (Article and FAQ) for search engines.</Point>
            <Point title="If something fails.">It tries again on the next runs. After 3 failed attempts the post goes back to draft and the error is in the Activity log. Fix it, then publish from the editor or drag the post to a new date.</Point>
          </Points>
        </Section>

        <Section id="editor" icon={<NavArticleIcon />} title="The article editor"
          lead={<>Open any post from the calendar or the Articles tab. If it isn't written yet, click <Ui>Generate Article with AI</Ui> and it's saved as a draft when done.</>}>
          <Points>
            <Point title="What you get.">A 1,500–2,000 word article built from research on the top results: a key takeaways summary, answer-first sections, an FAQ, cited sources (links that don't work or weren't found in research are removed), links to your own pages, a GEO score, meta title, description and URL slug, and a branded cover.</Point>
            <Point title="Edit it yourself.">Click <Ui>Manual Edit</Ui> to change the text directly, then <Ui>Save Changes</Ui>. The GEO score and meta are refreshed when you save.</Point>
            <Point title="Improve it with AI.">The <Ui>Optimization Roadmap</Ui> lists what to improve. Add your own direction under <Ui>Advanced Instructions</Ui> (for example "mention our Dallas service area"), then click <Ui>Rewrite with AI Intelligence</Ui>.</Point>
            <Point title="Images and meta.">Under Featured Image you can upload your own, make a new cover with <Ui>AI Generate</Ui>, download it, or <Ui>Sync image to WordPress</Ui>. Under Meta Settings, edit the title, description and slug or click <Ui>Auto-fill with AI</Ui>.</Point>
            <Point title="Publish now.">Click <Ui>Publish to WordPress</Ui> to go live straight away. Once live, the button becomes <Ui>Update Live Article</Ui> and the live link appears at the top.</Point>
          </Points>
          <Note>We recommend reading every article before it goes live and adding what only you know: your experience, prices, photos and local details. That's what makes content worth citing.</Note>
        </Section>

        <Section id="tracking" icon={<NavDashboardIcon />} title="Keeping track"
          lead="Three places show you what Autorank has done and what's next.">
          <Points>
            <Point title="Dashboard.">Your next article and its progress, whether auto-publish is on, keyword and article counts, and your latest published articles.</Point>
            <Point title="Articles.">Everything Autorank has written, filtered by drafts and published, with links to the live pages.</Point>
            <Point title="Activity log.">Every action from the last 3 days, including each auto-publish run and any errors.</Point>
          </Points>
        </Section>

        <Section id="plan" icon={<NavUserIcon />} title="Your plan and credits"
          lead={<>Open your account from the bottom of the sidebar to see your plan and what's left.</>}>
          <Points>
            <Point title="Free trial.">Includes 3 articles.</Point>
            <Point title="Standard plan.">30 articles a month. Each article written uses 1 credit, whether you click Generate or auto-publish writes it.</Point>
            <Point title="Free actions.">Publishing, updating live articles, GEO scoring, rewrites and new covers don't use credits.</Point>
          </Points>
        </Section>

        <section aria-labelledby="faq-title" className="bg-white border border-[#ECE9E2] rounded-2xl p-6 shadow-[0_1px_2px_rgba(28,27,25,0.05)]">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center flex-shrink-0">
              <NavHelpIcon className="w-[18px] h-[18px]" />
            </span>
            <h2 id="faq-title" className="font-serif text-[26px] leading-tight text-stone-900">Common questions</h2>
          </div>
          <div className="mt-4 divide-y divide-[#F0EEE9] border-t border-[#F0EEE9]">
            {FAQS.map(f => (
              <details key={f.q} className="group py-3.5">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[15px] font-medium text-stone-900">
                  {f.q}
                  <NavPlusIcon className="w-4 h-4 text-stone-400 flex-shrink-0 transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-2 pr-8 text-[14px] leading-relaxed text-stone-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-stone-500">
          <span>Still stuck? Email <a href="mailto:support@ntxwd.com" className="font-medium text-stone-900 hover:underline">support@ntxwd.com</a> or ask the assistant in the corner.</span>
          <a href="https://autorank-ai.com/help-center/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-stone-900 hover:underline">
            Guides on autorank-ai.com <NavArrowUpRightIcon className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
