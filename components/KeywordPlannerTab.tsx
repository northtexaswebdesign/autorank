
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Keyword, AppTab, KeywordOpportunity, ContentCluster } from '../types.ts';
import { useApp } from '../context/AppContext.tsx';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { PlusIcon } from './icons/PlusIcon.tsx';
import { StarIcon } from './icons/StarIcon.tsx';
import { KeywordIcon } from './icons/KeywordIcon.tsx';
import { LightbulbIcon } from './icons/LightbulbIcon.tsx';
import { HistoryIcon } from './icons/HistoryIcon.tsx';
import { CheckIcon } from './icons/CheckIcon.tsx';
import { CloseIcon } from './icons/CloseIcon.tsx';
import { AddKeywordModal } from './AddKeywordModal.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon.tsx';
import { ChevronRightIcon } from './icons/ChevronRightIcon.tsx';
import { Modal } from './Modal.tsx';
import { LinkIcon } from './icons/LinkIcon.tsx';


interface KeywordPlannerTabProps {
  setActiveTab: (tab: AppTab) => void;
}

const StatCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    count: number;
    description: string;
    isActive: boolean;
    onClick: () => void;
    disabled?: boolean;
}> = React.memo(({ icon, label, count, description, isActive, onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`p-4 text-left bg-gradient-to-br from-white to-slate-50 border rounded-xl shadow-lg transition-all duration-300 ease-in-out ${
            isActive 
                ? 'border-orange-400 shadow-orange-500/20' 
                : 'border-slate-200 hover:border-slate-300 hover:shadow-xl hover:-translate-y-1'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        <div className="flex items-start justify-between">
            <div className="text-slate-500">
                {icon}
            </div>
            <p className="text-3xl font-bold text-slate-900">{count}</p>
        </div>
        <h3 className="text-base font-semibold text-slate-800 mt-3">{label}</h3>
        <p className="text-xs text-slate-500">{description}</p>
    </button>
));


const KeywordRow: React.FC<{ 
    keyword: Keyword;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onToggleStar: (keyword: Keyword) => void;
    onDelete: (keyword: Keyword) => void;
    onAddToPlan: (keyword: Keyword) => void;
    onRemoveFromPlan: (keyword: Keyword) => void;
    onGenerate: (keyword: Keyword) => void;
    isLocked: boolean;
}> = React.memo(({ keyword, isSelected, onSelect, onToggleStar, onDelete, onAddToPlan, onRemoveFromPlan, onGenerate, isLocked }) => {
    
    const opportunityColor = {
        High: 'text-orange-700 bg-orange-100',
        Medium: 'text-amber-700 bg-amber-100',
        Low: 'text-stone-700 bg-stone-100'
    };

    const handleToggleStar = () => onToggleStar(keyword);
    const handleAddToPlan = () => onAddToPlan(keyword);
    const handleRemoveFromPlan = () => onRemoveFromPlan(keyword);
    const handleGenerate = () => onGenerate(keyword);
    
    return (
        <tr className={`md:border-b md:border-slate-200/80 md:hover:bg-slate-50/50 ${isSelected ? 'bg-orange-50/50' : ''}`}>
            <td className="text-center md:table-cell md:px-2 md:py-4 md:w-12 align-middle">
                <input 
                    type="checkbox" 
                    checked={isSelected} 
                    onChange={() => keyword.id && onSelect(keyword.id)}
                    className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 cursor-pointer accent-orange-600"
                />
            </td>
            <td className="text-center md:table-cell md:px-2 md:py-4 md:w-12 align-middle">
                <button onClick={handleToggleStar} className="p-2 text-slate-400 hover:text-amber-500">
                    <StarIcon className="w-5 h-5" filled={keyword.isStarred} />
                </button>
            </td>
            <td data-label="Keyword" className="md:table-cell md:px-4 md:py-4 align-middle">
                <p className="font-medium text-slate-800 md:text-left">{keyword.keyword}</p>
            </td>
            <td data-label="Opportunity" className="md:table-cell md:px-4 md:py-4 md:text-center align-middle">
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${opportunityColor[keyword.opportunity]}`}>
                    {keyword.opportunity}
                </span>
            </td>
            <td data-label="Generate" className="md:table-cell md:px-4 md:py-4 md:text-center align-middle">
                <button 
                    onClick={handleGenerate} 
                    disabled={isLocked}
                    title={isLocked ? "Your trial has ended. Please upgrade your plan." : "Generate article"}
                    className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-3 py-1.5 text-sm rounded-md font-semibold hover:from-amber-500 hover:to-orange-600 flex items-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1 active:scale-95 shadow-sm disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed"
                >
                    <SparklesIcon className="w-4 h-4 mr-1.5" />
                    Generate
                </button>
            </td>
            <td className="md:table-cell md:px-4 md:py-4 md:text-right align-middle">
                <div className="flex items-center justify-end gap-2">
                    {keyword.isQueued ? (
                         <button onClick={handleRemoveFromPlan} className="bg-slate-100 text-slate-700 px-3 py-1.5 text-sm rounded-md font-semibold hover:bg-slate-200 flex items-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 active:bg-slate-300 active:scale-95">
                            <CloseIcon className="w-4 h-4 mr-1.5" />
                            Remove from Plan
                        </button>
                    ) : (
                        <button onClick={handleAddToPlan} className="bg-orange-100 text-orange-700 px-3 py-1.5 text-sm rounded-md font-semibold hover:bg-orange-200 flex items-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1 active:bg-orange-300 active:scale-95">
                            <PlusIcon className="w-4 h-4 mr-1.5" />
                            Add to Plan
                        </button>
                    )}
                    <button onClick={() => onDelete(keyword)} className="p-2 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 active:bg-red-100">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </td>
        </tr>
    );
});

const TopicCard: React.FC<{
  topic: string;
  isPillar: boolean;
  isSelected: boolean;
  onToggle: () => void;
}> = React.memo(({ topic, isPillar, isSelected, onToggle }) => {
  return (
    <div
      onClick={onToggle}
      className={`p-4 rounded-lg border-2 flex items-start gap-4 cursor-pointer transition-all duration-200 ${
        isSelected
          ? isPillar ? 'bg-orange-50 border-orange-500' : 'bg-slate-50 border-slate-400'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        readOnly
        onClick={(e) => e.stopPropagation()}
        onChange={onToggle}
        className="mt-1 h-5 w-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
        aria-label={`Select topic: ${topic}`}
      />
      <div>
        <span
          className={`px-2 py-0.5 text-[10px] font-bold tracking-wider rounded ${
            isPillar
              ? 'bg-orange-100 text-orange-700'
              : 'bg-slate-200 text-slate-600'
          }`}
        >
          {isPillar ? 'PILLAR PAGE' : 'CLUSTER PAGE'}
        </span>
        <p className="font-semibold text-slate-800 mt-1.5">{topic}</p>
      </div>
    </div>
  );
});

const ContentClusterModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    cluster: ContentCluster | null;
    onAccept: (topics: string[]) => void;
    onGenerate: (keyword: string) => void;
    onSuggestAnother: () => void;
    isLoading: boolean;
}> = ({ isOpen, onClose, cluster, onAccept, onGenerate, onSuggestAnother, isLoading }) => {
    
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [targetKeyword, setTargetKeyword] = useState('');

    useEffect(() => {
        if (cluster) {
            setSelectedTopics([cluster.pillar, ...cluster.clusters]);
        } else {
            setSelectedTopics([]);
        }
    }, [cluster]);

    useEffect(() => {
        if (isOpen && !cluster && !isLoading) {
            setTargetKeyword('');
        }
    }, [isOpen]);

    const handleToggleTopic = (topic: string) => {
        setSelectedTopics(prev => 
            prev.includes(topic)
                ? prev.filter(t => t !== topic)
                : [...prev, topic]
        );
    };
    
    return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI-Suggested Content Cluster">
        {isLoading ? (
            <div className="text-center py-20">
                <SparklesIcon className="w-12 h-12 mx-auto text-slate-300 animate-spin mb-4" />
                <p className="text-slate-600">Analyzing keyword to find the best cluster...</p>
            </div>
        ) : cluster ? (
            <div>
                <p className="text-slate-600 mb-6">The AI has identified a strategic content cluster to build topical authority. Deselect any topics you don't want to add to your plan.</p>
                
                 <div className="space-y-4">
                    <TopicCard
                        topic={cluster.pillar}
                        isPillar={true}
                        isSelected={selectedTopics.includes(cluster.pillar)}
                        onToggle={() => handleToggleTopic(cluster.pillar)}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {cluster.clusters.map((c, index) => (
                            <TopicCard
                                key={index}
                                topic={c}
                                isPillar={false}
                                isSelected={selectedTopics.includes(c)}
                                onToggle={() => handleToggleTopic(c)}
                            />
                        ))}
                    </div>
                </div>

                 <div className="flex justify-end items-center gap-3 mt-8">
                    <button onClick={onSuggestAnother} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-semibold hover:bg-slate-200">
                        Suggest Another
                    </button>
                    <button 
                        onClick={() => onAccept(selectedTopics)} 
                        disabled={selectedTopics.length === 0}
                        className="bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-600 flex items-center disabled:bg-orange-300"
                    >
                        <CheckIcon className="w-5 h-5 mr-2" />
                        Accept & Add {selectedTopics.length} to Plan
                    </button>
                </div>
            </div>
        ) : (
            <div className="py-8">
                 <p className="text-slate-600 mb-4">Enter a core keyword or topic (e.g., "Gun Site") and the AI will generate a strategic content cluster around it, including a pillar topic and 5-7 related cluster topics.</p>
                 <div className="flex flex-col gap-4">
                     <input
                         type="text"
                         value={targetKeyword}
                         onChange={(e) => setTargetKeyword(e.target.value)}
                         placeholder="Enter target keyword..."
                         className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                         autoFocus
                         onKeyDown={(e) => {
                             if (e.key === 'Enter' && targetKeyword.trim()) {
                                 onGenerate(targetKeyword.trim());
                             }
                         }}
                     />
                     <div className="flex justify-end">
                         <button 
                             onClick={() => onGenerate(targetKeyword.trim())} 
                             disabled={!targetKeyword.trim()}
                             className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:bg-orange-300 transition-colors"
                         >
                             Generate Cluster
                         </button>
                     </div>
                 </div>
            </div>
        )}
    </Modal>
)};

export const KeywordPlannerTab: React.FC<KeywordPlannerTabProps> = ({ setActiveTab }) => {
    const { 
        selectedBusiness, 
        suggestedKeywords, 
        queuedKeywords, 
        scheduledPosts,
        addKeyword,
        addKeywordToQueue,
        addKeywordsToQueue,
        removeKeywordFromQueue,
        deleteKeyword,
        deleteKeywords,
        generateAndStoreKeywords, 
        suggestContentCluster,
        generateArticleFromKeyword,
        toggleKeywordStar,
        isLocked,
    } = useApp();

    const [activeFilter, setActiveFilter] = useState<'recommended' | 'plan' | 'starred' | 'all'>('recommended');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isClusterModalOpen, setIsClusterModalOpen] = useState(false);
    const [isSuggestingCluster, setIsSuggestingCluster] = useState(false);
    const [suggestedCluster, setSuggestedCluster] = useState<ContentCluster | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // New state for language selection
    const [selectedLanguage, setSelectedLanguage] = useState<string>('English');
    const KEYWORDS_PER_PAGE = 30;
    
    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set()); // Reset selection when filter changes
    }, [activeFilter, searchTerm]);

    // Initialize language from business settings when available
    useEffect(() => {
        if (selectedBusiness?.language) {
            setSelectedLanguage(selectedBusiness.language);
        }
    }, [selectedBusiness?.language]);

    const allKeywords = useMemo(() => [...suggestedKeywords, ...queuedKeywords], [suggestedKeywords, queuedKeywords]);

    const memoizedKeywords = useMemo(() => {
        let keywords: Keyword[] = [];
        switch (activeFilter) {
            case 'recommended':
                keywords = suggestedKeywords.filter(kw => !kw.isQueued);
                break;
            case 'plan':
                keywords = queuedKeywords;
                break;
            case 'starred':
                keywords = allKeywords.filter(kw => kw.isStarred);
                break;
            case 'all':
            default:
                keywords = allKeywords;
                break;
        }
        if (searchTerm) {
            return keywords.filter(k => k.keyword.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return keywords;
    }, [activeFilter, searchTerm, suggestedKeywords, queuedKeywords, allKeywords]);

    const paginatedKeywords = useMemo(() => {
        const startIndex = (currentPage - 1) * KEYWORDS_PER_PAGE;
        return memoizedKeywords.slice(startIndex, startIndex + KEYWORDS_PER_PAGE);
    }, [currentPage, memoizedKeywords]);
    
    const totalPages = Math.ceil(memoizedKeywords.length / KEYWORDS_PER_PAGE);
    
    const filterMetadata = {
        all: { title: "All Keywords", description: "This is your complete keyword library, including recommended, planned and starred keywords." },
        recommended: { title: "Recommended Keywords", description: "These are keywords we recommend targeting. Add them to your Content Plan to get them ready for scheduling." },
        plan: { title: "Content Plan", description: "Approved keywords that are ready to be scheduled on the calendar via the 'Autofill' feature." },
        starred: { title: "Starred Keywords", description: "Your hand-picked, favorite keywords that you want to keep an eye on." },
    };

    const handleGenerateKeywords = async () => {
        if (!selectedBusiness) return;
        setIsGeneratingKeywords(true);
        try {
            await generateAndStoreKeywords(selectedLanguage);
        } catch (error) {
            console.error(error);
            alert((error as any)?.message || "Failed to generate keywords. Please try again.");
        }
        setIsGeneratingKeywords(false);
    };

    const handleOpenClusterModal = () => {
        setSuggestedCluster(null);
        setIsClusterModalOpen(true);
    };

    const handleGenerateCluster = async (keyword: string) => {
        setIsSuggestingCluster(true);
        try {
            const cluster = await suggestContentCluster(keyword);
            setSuggestedCluster(cluster);
        } catch (error) {
            console.error("Failed to suggest cluster:", error);
            alert("Could not suggest a content cluster. Please try a different keyword.");
        } finally {
            setIsSuggestingCluster(false);
        }
    };

    const handleAcceptCluster = async (topics: string[]) => {
        const keywordsToAdd: Omit<Keyword, 'id' | 'businessId'>[] = topics.map(kwString => {
            const existing = allKeywords.find(k => k.keyword === kwString);
            return {
                keyword: kwString,
                opportunity: existing?.opportunity || KeywordOpportunity.Medium,
                isQueued: true,
                isStarred: false,
            };
        });
        
        await addKeywordsToQueue(keywordsToAdd as Omit<Keyword, 'id'>[]);
        setIsClusterModalOpen(false);
        setSuggestedCluster(null);
        setActiveFilter('plan');
        alert(`${topics.length} keywords from the cluster have been added to your plan!`);
    };


    const handleAddKeyword = useCallback(async (keywordString: string) => {
        const newKeyword: Omit<Keyword, 'id'> = {
            keyword: keywordString,
            opportunity: KeywordOpportunity.Medium,
            isQueued: false,
            isStarred: false,
        };
        await addKeyword(newKeyword);
        setIsAddModalOpen(false);
    }, [addKeyword]);
    
    const handleDeleteKeyword = useCallback(async (keyword: Keyword) => {
        if (keyword.id) await deleteKeyword(keyword.id);
    }, [deleteKeyword]);

    const handleToggleStar = useCallback((keyword: Keyword) => {
        toggleKeywordStar(keyword);
    }, [toggleKeywordStar]);

    const handleAddToPlan = useCallback((keyword: Keyword) => {
        addKeywordToQueue(keyword);
    }, [addKeywordToQueue]);

    const handleRemoveFromPlan = useCallback((keyword: Keyword) => {
        removeKeywordFromQueue(keyword);
    }, [removeKeywordFromQueue]);

    // a keyword already being turned into an article ignores further clicks (each click would create a post)
    const generatingKeywords = useRef(new Set<string>());
    const handleGenerateArticle = useCallback(async (keyword: Keyword) => {
        const key = keyword.id || keyword.keyword;
        if (generatingKeywords.current.has(key)) return;
        generatingKeywords.current.add(key);
        try { await generateArticleFromKeyword(keyword); }
        finally { generatingKeywords.current.delete(key); }
    }, [generateArticleFromKeyword]);

    // Bulk Actions
    const handleSelectOne = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        const pageIds = paginatedKeywords.map(k => k.id).filter(id => id) as string[];
        const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
        
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allSelected) {
                pageIds.forEach(id => next.delete(id));
            } else {
                pageIds.forEach(id => next.add(id));
            }
            return next;
        });
    }, [paginatedKeywords, selectedIds]);

    const handleBulkDelete = async () => {
        const count = selectedIds.size;
        if (count === 0) return;
        
        await deleteKeywords(Array.from(selectedIds));
        setSelectedIds(new Set());
    };
    
    const statCounts = useMemo(() => ({
        all: allKeywords.length,
        recommended: suggestedKeywords.filter(kw => !kw.isQueued).length,
        starred: allKeywords.filter(kw => kw.isStarred).length,
        plan: queuedKeywords.length,
        generated: scheduledPosts.filter(p => p.status === 'draft' || p.status === 'published').length,
    }), [allKeywords, suggestedKeywords, queuedKeywords, scheduledPosts]);

    const hasAnalysis = !!selectedBusiness?.competitorAnalysis;
    const generateButtonText = isGeneratingKeywords ? 'Generating...' : (hasAnalysis ? 'Generate with AI Insights' : 'Generate Ideas');
    const generateButtonTitle = hasAnalysis 
        ? "Using strategic recommendations from your AI Intelligence report to generate more targeted keywords." 
        : "Generate new keyword ideas using your business profile.";
    
    const handleFilterAll = useCallback(() => setActiveFilter('all'), []);
    const handleFilterRecommended = useCallback(() => setActiveFilter('recommended'), []);
    const handleFilterStarred = useCallback(() => setActiveFilter('starred'), []);
    const handleFilterPlan = useCallback(() => setActiveFilter('plan'), []);
    const handleGoToPastArticles = useCallback(() => setActiveTab('past-articles'), [setActiveTab]);

    const isAllPageSelected = paginatedKeywords.length > 0 && paginatedKeywords.every(k => k.id && selectedIds.has(k.id));

    return (
        <div>
            <div className="flex justify-between items-baseline mb-2">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Keyword Planner</h1>
                {selectedBusiness && (
                    <h2 className="text-xl font-semibold text-slate-600 tracking-tight">Welcome, {selectedBusiness.name}!</h2>
                )}
            </div>
            <p className="text-slate-600 mb-8">{filterMetadata[activeFilter].description}</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard icon={<KeywordIcon className="w-6 h-6"/>} label="All Keywords" count={statCounts.all} description="Complete keyword list" isActive={activeFilter === 'all'} onClick={handleFilterAll} />
                <StatCard icon={<LightbulbIcon className="w-6 h-6"/>} label="Recommended" count={statCounts.recommended} description="First keywords to target" isActive={activeFilter === 'recommended'} onClick={handleFilterRecommended} />
                <StatCard icon={<StarIcon className="w-6 h-6"/>} label="Starred" count={statCounts.starred} description="Your starred keywords" isActive={activeFilter === 'starred'} onClick={handleFilterStarred} />
                <StatCard icon={<HistoryIcon className="w-6 h-6"/>} label="Content Plan" count={statCounts.plan} description="Approved ideas for scheduling" isActive={activeFilter === 'plan'} onClick={handleFilterPlan} />
                <StatCard icon={<CheckIcon className="w-6 h-6"/>} label="Written" count={statCounts.generated} description="Your written articles" isActive={false} onClick={handleGoToPastArticles} />
                <StatCard icon={<CloseIcon className="w-6 h-6"/>} label="Failed" count={0} description="Action required" isActive={false} onClick={() => {}} disabled />
            </div>

            <div className="mt-8 bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                    <div className="flex gap-2 items-center flex-wrap">
                         <button onClick={() => setIsAddModalOpen(true)} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-semibold hover:bg-slate-900 flex items-center transition-colors shadow-sm">
                           <PlusIcon className="w-5 h-5 mr-2" />
                           Add Keyword
                        </button>
                        
                        <div className="h-8 w-px bg-slate-300 mx-2 hidden md:block"></div>

                        <select
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                            className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block px-3 py-2 cursor-pointer hover:border-orange-400 transition-colors"
                            title="Select target language for new keywords"
                        >
                            <option value="English">English</option>
                            <option value="Vietnamese">Vietnamese</option>
                            <option value="Spanish">Spanish</option>
                            <option value="French">French</option>
                            <option value="German">German</option>
                        </select>

                        <button 
                            onClick={handleGenerateKeywords} 
                            disabled={isGeneratingKeywords || !selectedBusiness}
                            title={generateButtonTitle}
                            className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-4 py-2 rounded-lg font-semibold hover:from-amber-500 hover:to-orange-600 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed flex items-center transition-all shadow-sm"
                        >
                           <SparklesIcon className={`w-5 h-5 mr-2 ${isGeneratingKeywords ? 'animate-spin' : ''}`} />
                           {generateButtonText}
                        </button>
                        <button 
                            onClick={handleOpenClusterModal} 
                            disabled={!selectedBusiness}
                            title="Suggest a Content Cluster"
                            className="bg-gradient-to-r from-orange-600 to-red-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-orange-700 hover:to-red-800 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed flex items-center transition-all shadow-sm"
                        >
                           <LinkIcon className={`w-5 h-5 mr-2 ${isSuggestingCluster ? 'animate-spin' : ''}`} />
                           Suggest Cluster
                        </button>
                        
                        {selectedIds.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-lg font-semibold hover:bg-red-200 flex items-center transition-colors shadow-sm ml-2 animate-pulse"
                            >
                                <TrashIcon className="w-5 h-5 mr-2" />
                                Delete Selected ({selectedIds.size})
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search keywords..."
                            className="w-full md:w-64 bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 transition"
                        />
                         <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm responsive-table">
                        <thead className="md:table-header-group">
                            <tr className="text-left font-semibold text-slate-500 bg-slate-50">
                                <th className="px-2 py-3 w-12 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={isAllPageSelected}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 cursor-pointer accent-orange-600"
                                        title="Select all on this page"
                                    />
                                </th>
                                <th className="px-2 py-3 w-12"></th>
                                <th className="px-4 py-3">Keyword</th>
                                <th className="px-4 py-3 text-center">Opportunity</th>
                                <th className="px-4 py-3 text-center">Generate</th>
                                <th className="px-4 py-3 rounded-r-lg text-right">Actions</th>
                            </tr>
                        </thead>
                         <tbody>
                            {paginatedKeywords.map(kw => (
                                <KeywordRow 
                                    key={kw.id} 
                                    keyword={kw}
                                    isSelected={kw.id ? selectedIds.has(kw.id) : false}
                                    onSelect={handleSelectOne}
                                    onToggleStar={handleToggleStar}
                                    onDelete={handleDeleteKeyword}
                                    onAddToPlan={handleAddToPlan}
                                    onRemoveFromPlan={handleRemoveFromPlan}
                                    onGenerate={handleGenerateArticle}
                                    isLocked={isLocked}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>

                {memoizedKeywords.length === 0 && (
                     <div className="text-center py-16">
                        <KeywordIcon className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500">No keywords found for this filter.</p>
                        {activeFilter === 'recommended' && <p className="text-slate-500 mt-1">Try generating new ideas!</p>}
                    </div>
                )}
                
                 {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-6 text-sm">
                        <div>
                            <p className="text-slate-600">
                                Showing <span className="font-semibold">{paginatedKeywords.length}</span> of <span className="font-semibold">{memoizedKeywords.length}</span> keywords
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                             <button
                                onClick={() => setCurrentPage(p => p - 1)}
                                disabled={currentPage === 1}
                                className="px-2 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                            <span className="text-slate-600 font-medium">
                                Page {currentPage} of {totalPages}
                            </span>
                             <button
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={currentPage === totalPages}
                                className="px-2 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

            </div>
             <AddKeywordModal 
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAddKeyword={handleAddKeyword}
            />
            <ContentClusterModal
                isOpen={isClusterModalOpen}
                onClose={() => setIsClusterModalOpen(false)}
                cluster={suggestedCluster}
                onAccept={handleAcceptCluster}
                onGenerate={handleGenerateCluster}
                onSuggestAnother={handleOpenClusterModal}
                isLoading={isSuggestingCluster}
            />
        </div>
    );
};
