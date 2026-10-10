import React, { useState, createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { AppTab, BusinessInfo, Keyword, ScheduledPost, CmsIntegration, AppContextType, ActivityLog, UserProfile, KeywordOpportunity } from './types.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { BusinessInfoTab } from './components/BusinessInfoTab.tsx';
import { KeywordPlannerTab } from './components/KeywordPlannerTab.tsx';
import { CalendarTab } from './components/CalendarTab.tsx';
import { CMSIntegrationTab } from './components/CMSIntegrationTab.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { OnboardingModal } from './components/OnboardingModal.tsx';
import { supabase } from './services/supabaseClient.ts';
import { Session } from '@supabase/supabase-js';
import { fetchArticleContent } from './utils/contentStorage.ts';
import { generateKeywords, suggestContentCluster as suggestContentClusterService, analyzeCompetitors as analyzeCompetitorsService } from './services/aiService.ts';
import { ContentGenerationScreen } from './components/ContentGenerationScreen.tsx';
import { ActivityLogTab } from './components/ActivityLogTab.tsx';
import { sessionCache } from './services/inMemoryCache.ts';
import { PastArticlesTab } from './components/PastArticlesTab.tsx';
import { AIKeywordsIntelligenceTab } from './components/AIKeywordsIntelligenceTab.tsx';
import { Chatbot } from './components/Chatbot.tsx';
import { HelpTab } from './components/HelpTab.tsx';
import { snakeToCamel, camelToSnake } from './utils/caseConverter.ts';
import { AccountSettingsTab } from './components/AccountSettingsTab.tsx';
import { DashboardTab } from './components/DashboardTab.tsx';
import { HamburgerIcon } from './components/icons/HamburgerIcon.tsx';
import { SparklesIcon } from './components/icons/SparklesIcon.tsx';

import { AppContext, useApp } from './context/AppContext.tsx';

const POST_COLUMNS_FOR_LIST_VIEW = 'id, business_id, keyword, publish_date, status, published_url, geo_score, meta_title, meta_description, slug, updated_at, content_url';

const AppProvider: React.FC<{ children: React.ReactNode; session: Session }> = ({ children, session }) => {
    const { user } = session;

    const [selectedBusiness, setSelectedBusiness] = useState<BusinessInfo | null>(null);
    const [suggestedKeywords, setSuggestedKeywords] = useState<Keyword[]>([]);
    const [queuedKeywords, setQueuedKeywords] = useState<Keyword[]>([]);
    const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
    const [cmsIntegration, setCmsIntegration] = useState<CmsIntegration | null>(null);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [userProfile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    
    const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
    const [isLoadingEditingPost, setIsLoadingEditingPost] = useState(false);

    const fetchAllData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (profileData) setProfile(snakeToCamel<UserProfile>(profileData));

            const { data: businesses } = await supabase.from('businesses').select('*').eq('user_id', user.id);
            const currentBusiness = businesses?.[0] ? snakeToCamel<BusinessInfo>(businesses[0]) : null;
            setSelectedBusiness(currentBusiness);

            if (currentBusiness) {
                const [keywordsRes, postsRes, cmsRes, logsRes] = await Promise.all([
                    supabase.from('keywords').select('*').eq('business_id', currentBusiness.id).limit(1000),
                    supabase.from('posts').select(POST_COLUMNS_FOR_LIST_VIEW).eq('business_id', currentBusiness.id).order('publish_date', { ascending: false }).limit(500),
                    supabase.from('cms_integrations').select('*').eq('business_id', currentBusiness.id),
                    supabase.from('activity_logs').select('*').eq('business_id', currentBusiness.id).order('created_at', { ascending: false }).limit(50)
                ]);

                if (keywordsRes.error) console.error("Error fetching keywords:", keywordsRes.error);
                if (postsRes.error) console.error("Error fetching posts:", postsRes.error);
                if (cmsRes.error) console.error("Error fetching CMS:", cmsRes.error);
                if (logsRes.error) console.error("Error fetching logs:", logsRes.error);

                if (keywordsRes.data) {
                    const kws = snakeToCamel<Keyword[]>(keywordsRes.data);
                    setQueuedKeywords(kws.filter(k => k.isQueued));
                    setSuggestedKeywords(kws.filter(k => !k.isQueued));
                }
                if (postsRes.data) setScheduledPosts(snakeToCamel<ScheduledPost[]>(postsRes.data));
                if (cmsRes.data?.[0]) setCmsIntegration(snakeToCamel<CmsIntegration>(cmsRes.data[0]));
                if (logsRes.data) setActivityLogs(snakeToCamel<ActivityLog[]>(logsRes.data));
            }
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    useEffect(() => {
        if (!editingPostId) {
            setEditingPost(null);
            return;
        }

        const loadFullArticle = async () => {
            const cached = sessionCache.get<ScheduledPost>(`post-${editingPostId}`);
            if (cached && (cached.articleContent || (cached as any).article_content || cached.contentUrl || cached.content_url)) {
                setEditingPost(cached);
                return;
            }

            setIsLoadingEditingPost(true);
            try {
                const { data, error } = await supabase
                    .from('posts')
                    .select('*')
                    .eq('id', editingPostId)
                    .single();

                if (data) {
                    // Senior Note: We merge the camelCase data while keeping the original object available for legacy checks
                    const converted = snakeToCamel<ScheduledPost>(data);
                    const merged = { ...data, ...converted };
                    
                    // Fetch content from storage if we have a URL but no direct content
                    if ((merged.contentUrl || merged.content_url) && !merged.articleContent && !(merged as any).article_content) {
                        const html = await fetchArticleContent(merged.contentUrl || merged.content_url);
                        if (html) {
                            merged.articleContent = html;
                            (merged as any).article_content = html;
                        } else {
                            merged.articleContent = "<div class='p-8 bg-red-50 text-red-600 rounded-lg border border-red-200'><h3>Error Loading Content</h3><p>Failed to load the article content from storage. The file may have been deleted or is inaccessible.</p></div>";
                            (merged as any).article_content = merged.articleContent;
                        }
                    }

                    sessionCache.set(`post-${editingPostId}`, merged);
                    setEditingPost(merged);
                }
            } finally {
                setIsLoadingEditingPost(false);
            }
        };

        loadFullArticle();
    }, [editingPostId]);

    /** Every keyword the business already targets (keyword lists and articles), so research never repeats one. */
    const targetedKeywords = () => [...new Set([...suggestedKeywords, ...queuedKeywords].map(k => k.keyword).concat(scheduledPosts.map(p => p.keyword)).filter(Boolean))];

    const contextValue: AppContextType = {
        selectedBusiness, 
        updateBusiness: async (info) => {
            // competitorAnalyzedAt is server-managed (monthly limit); never written from the browser
            const { competitorAnalyzedAt: _serverManaged, ...editable } = info;
            await supabase.from('businesses').update(camelToSnake(editable)).eq('id', info.id);
            setSelectedBusiness(info);
        },
        createBusiness: async (info) => {
            const { data } = await supabase.from('businesses').insert(camelToSnake({ ...info, userId: user.id })).select().single();
            if (data) {
                const bus = snakeToCamel<BusinessInfo>(data);
                setSelectedBusiness(bus);
                return bus;
            }
            return null;
        },
        suggestedKeywords, 
        queuedKeywords, 
        addKeyword: async (kw) => {
            if (!selectedBusiness) return;
            const payload = camelToSnake({ ...kw, businessId: selectedBusiness.id });
            const { data } = await supabase.from('keywords').insert(payload).select().single();
            if (data) {
                const newKw = snakeToCamel<Keyword>(data);
                if (newKw.isQueued) setQueuedKeywords(p => [newKw, ...p]);
                else setSuggestedKeywords(p => [newKw, ...p]);
            }
        },
        addKeywordToQueue: async (kw) => {
            if (!kw.id) return;
            await supabase.from('keywords').update({ is_queued: true }).eq('id', kw.id);
            setSuggestedKeywords(p => p.filter(k => k.id !== kw.id));
            setQueuedKeywords(p => [{ ...kw, isQueued: true }, ...p]);
        },
        removeKeywordFromQueue: async (kw) => {
            if (!kw.id) return;
            await supabase.from('keywords').update({ is_queued: false }).eq('id', kw.id);
            setQueuedKeywords(p => p.filter(k => k.id !== kw.id));
            setSuggestedKeywords(p => [{ ...kw, isQueued: false }, ...p]);
        },
        deleteKeyword: async (id) => {
            await supabase.from('keywords').delete().eq('id', id);
            setSuggestedKeywords(p => p.filter(k => k.id !== id));
            setQueuedKeywords(p => p.filter(k => k.id !== id));
        },
        scheduledPosts,
        updateScheduledPost: async (id, updates) => {
            // Senior Fix: Ensure heavy fields like content are manually handled if they aren't camelized properly
        
            const { images, articleContent, article_content, ...restUpdates } = updates as any;
            const snaked: Record<string, any> = { ...(camelToSnake(restUpdates) as Record<string, any>), ...(images !== undefined && { images }) };
            
            // Explicitly clear article_content in DB if we are moving to content_url
            if (updates.contentUrl || updates.content_url) {
                snaked.article_content = null;
            } else if (articleContent !== undefined) {
                snaked.article_content = articleContent;
            } else if (article_content !== undefined) {
                snaked.article_content = article_content;
            }

            const { data, error } = await supabase.from('posts').update(snaked).eq('id', id).select().single();
            if (error) {
                console.error("Error updating post:", error);
                if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
                    alert("Error updating post: Could not connect to the server. Please check your internet connection.");
                } else {
                    alert("Error updating post: " + error.message);
                }
            }
            if (data) {
                const updated = snakeToCamel<ScheduledPost>(data);
                const dbMerged = { ...data, ...updated };
                // Preserve heavy fields (article_content, images) from existing cache
                // so they are not wiped when a partial update (e.g. metaTitle only) returns from DB
                const existing = sessionCache.get<ScheduledPost>(`post-${id}`);
                
                // If we passed articleContent in updates, use it for the local cache even if we didn't save it to DB
                const finalArticleContent = articleContent !== undefined ? articleContent : 
                                            article_content !== undefined ? article_content :
                                            (dbMerged as any).article_content || (existing as any)?.article_content || (existing as any)?.articleContent || '';

                const merged = {
                    ...(existing || {}),
                    ...dbMerged,
                    article_content: finalArticleContent,
                    articleContent: finalArticleContent,
                    images: (dbMerged as any).images || (existing as any)?.images || null,
                };
                setScheduledPosts(p => p.map(post => post.id === id ? merged : post));
                if (articleContent !== undefined || article_content !== undefined) {
                    // the server may have used a credit / trial article; refresh the counters
                    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data: pd }) => { if (pd) setProfile(snakeToCamel<UserProfile>(pd)); });
                }
                if (editingPostId === id) {
                    setEditingPost(merged);
                    sessionCache.set(`post-${id}`, merged);
                }
                return merged;
            }
            return null;
        },
        deleteScheduledPost: async (id) => {
            await supabase.from('posts').delete().eq('id', id);
            setScheduledPosts(p => p.filter(post => post.id !== id));
            sessionCache.delete(`post-${id}`);
            if (editingPostId === id) setEditingPostId(null);
        },
        loading, 
        editingPost, 
        setEditingPost: (p) => setEditingPostId(p?.id || null),
        activeTab, 
        setActiveTab,
        isLoadingEditingPost,
        editingPostId,
        userProfile,
        logActivity: async (message, status) => {
            if (!selectedBusiness) return;
            const { data } = await supabase.from('activity_logs').insert(camelToSnake({
                createdAt: new Date().toISOString(),
                jobName: 'UI Action',
                status,
                message,
                businessId: selectedBusiness.id
            })).select().single();
            if (data) setActivityLogs(prev => [snakeToCamel<ActivityLog>(data), ...prev]);
        },
        analyzeCompetitors: async (onProgress) => {
            if (!selectedBusiness) return;
            const analysis = await analyzeCompetitorsService(selectedBusiness, onProgress); // throws if the monthly limit is used or every step failed
            if (analysis) {
                await contextValue.updateBusiness({ ...selectedBusiness, competitorAnalysis: analysis, competitorAnalyzedAt: new Date().toISOString() });
            }
        },
        generateAndStoreKeywords: async (language) => {
            if (!selectedBusiness) return;
            const kws = await generateKeywords(selectedBusiness, language, targetedKeywords());
            if (kws.length > 0) {
                const toInsert = kws.map(k => camelToSnake({ ...k, businessId: selectedBusiness.id }));
                const { data } = await supabase.from('keywords').insert(toInsert).select();
                if (data) setSuggestedKeywords(prev => [...snakeToCamel<Keyword[]>(data), ...prev]);
            }
        },
        generateArticleFromKeyword: async (kw) => {
            if (!selectedBusiness) return;
            const [postRes] = await contextValue.addScheduledPosts([{ 
                keyword: kw.keyword, 
                publishDate: new Date().toISOString(), 
                status: 'draft' 
            }]) || [];
            if (postRes && kw.id) {
                await contextValue.deleteKeyword(kw.id);
                setEditingPostId(postRes.id);
            }
        },
        addScheduledPosts: async (posts) => {
            if (!selectedBusiness) return null;
            const payload = posts.map(p => camelToSnake({ ...p, businessId: selectedBusiness.id }));
            const { data } = await supabase.from('posts').insert(payload).select();
            if (data) {
                const newPosts = snakeToCamel<ScheduledPost[]>(data);
                setScheduledPosts(prev => [...newPosts, ...prev]);
                return newPosts;
            }
            return null;
        },
        schedulePostsFromContentPlan: async () => {
            if (!selectedBusiness || queuedKeywords.length === 0) return;
            const existingDates = new Set(scheduledPosts.map(p => new Date(p.publishDate).toISOString().split('T')[0]));
            let currentDate = new Date();
            currentDate.setDate(currentDate.getDate() + 1);
            
            const posts = queuedKeywords.map((kw) => {
                while (existingDates.has(currentDate.toISOString().split('T')[0])) {
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                const d = new Date(currentDate);
                existingDates.add(d.toISOString().split('T')[0]);
                return { keyword: kw.keyword, publishDate: d.toISOString(), status: 'scheduled' as const };
            });
            await contextValue.addScheduledPosts(posts);
            const ids = queuedKeywords.map(k => k.id!).filter(Boolean);
            await contextValue.deleteKeywords(ids);
        },
        schedulePostsFromAllKeywords: async () => {
            if (!selectedBusiness || suggestedKeywords.length === 0) return;
            const existingDates = new Set(scheduledPosts.map(p => new Date(p.publishDate).toISOString().split('T')[0]));
            let currentDate = new Date();
            currentDate.setDate(currentDate.getDate() + 1);
            
            const posts = suggestedKeywords.map((kw) => {
                while (existingDates.has(currentDate.toISOString().split('T')[0])) {
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                const d = new Date(currentDate);
                existingDates.add(d.toISOString().split('T')[0]);
                return { keyword: kw.keyword, publishDate: d.toISOString(), status: 'scheduled' as const };
            });
            await contextValue.addScheduledPosts(posts);
            const ids = suggestedKeywords.map(k => k.id!).filter(Boolean);
            await contextValue.deleteKeywords(ids);
        },
        deleteKeywords: async (ids) => {
            await supabase.from('keywords').delete().in('id', ids);
            setSuggestedKeywords(p => p.filter(k => !k.id || !ids.includes(k.id)));
            setQueuedKeywords(p => p.filter(k => !k.id || !ids.includes(k.id)));
        },
        addKeywordsToQueue: async (kws) => {
            if (!selectedBusiness) return;
            const { data } = await supabase.from('keywords').insert(kws.map(k => camelToSnake({ ...k, businessId: selectedBusiness.id, isQueued: true }))).select();
            if (data) setQueuedKeywords(prev => [...snakeToCamel<Keyword[]>(data), ...prev]);
        },
        toggleKeywordStar: async (kw) => {
            if (!kw.id) return;
            const next = !kw.isStarred;
            await supabase.from('keywords').update({ is_starred: next }).eq('id', kw.id);
            const updateFn = (k: Keyword) => k.id === kw.id ? { ...k, isStarred: next } : k;
            setSuggestedKeywords(prev => prev.map(updateFn));
            setQueuedKeywords(prev => prev.map(updateFn));
        },
        suggestContentCluster: async (targetKeyword: string) => {
            if (!selectedBusiness) return null;
            return suggestContentClusterService(targetKeyword, selectedBusiness, targetedKeywords().filter(k => k !== targetKeyword));
        },
        unschedulePost: async (id) => {
            const post = scheduledPosts.find(p => p.id === id);
            if (post) {
                await contextValue.deleteScheduledPost(id);
                await contextValue.addKeyword({ keyword: post.keyword, opportunity: KeywordOpportunity.Medium, isQueued: true });
            }
        },
        updateCmsIntegration: async (integration) => {
            if (!selectedBusiness) return;
            const payload = camelToSnake({ ...integration, businessId: selectedBusiness.id, platform: 'wordpress' });
            if (cmsIntegration) {
                await supabase.from('cms_integrations').update(payload).eq('id', cmsIntegration.id);
                setCmsIntegration({ ...cmsIntegration, ...integration });
            } else {
                const { data } = await supabase.from('cms_integrations').insert(payload).select().single();
                if (data) setCmsIntegration(snakeToCamel<CmsIntegration>(data));
            }
        },
        updateUserProfile: async (profile) => {
            if (!userProfile) return;
            const { data } = await supabase.from('profiles').update(camelToSnake(profile)).eq('id', userProfile.id).select().single();
            if (data) setProfile(snakeToCamel<UserProfile>(data));
        },
        cachePlanData: async (data) => {
            if (selectedBusiness) await contextValue.updateBusiness({ ...selectedBusiness, planData: data });
        },
        isLocked: userProfile?.planStatus === 'expired' ||
            (userProfile?.planStatus === 'trial' && (userProfile.trialArticlesCreated ?? 0) >= 3) ||
            (userProfile?.planStatus === 'paid' && (userProfile.creditsRemaining ?? 0) <= 0),
        isTrialExpired: userProfile?.planStatus === 'trial' && (userProfile.trialArticlesCreated ?? 0) >= 3,
        isSubscriptionExpired: userProfile?.planStatus === 'expired',
        cmsIntegration,
        activityLogs
    };

    return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

const AppInner: React.FC = () => {
    const { activeTab, setActiveTab, setEditingPost, editingPost, selectedBusiness, createBusiness, userProfile, isLoadingEditingPost, editingPostId, loading } = useApp();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="flex flex-col items-center">
                    <SparklesIcon className="w-12 h-12 text-orange-500 animate-spin mb-4" />
                    <p className="text-slate-500 font-medium">Loading your workspace...</p>
                </div>
            </div>
        );
    }

    if (!selectedBusiness) return <OnboardingModal onComplete={createBusiness} />;
    
    const renderTab = () => {
        switch (activeTab) {
            case 'dashboard': return <DashboardTab />;
            case 'planner': return <KeywordPlannerTab setActiveTab={setActiveTab} />;
            case 'intelligence': return <AIKeywordsIntelligenceTab />;
            case 'calendar': return <CalendarTab />;
            case 'past-articles': return <PastArticlesTab />;
            case 'settings': return <BusinessInfoTab setActiveTab={setActiveTab} />;
            case 'integrations': return <CMSIntegrationTab />;
            case 'log': return <ActivityLogTab />;
            case 'account-settings': return <AccountSettingsTab />;
            case 'help': return <HelpTab />;
            default: return <DashboardTab />;
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar 
                activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}
                onLogout={() => supabase.auth.signOut()} setEditingPost={setEditingPost} userEmail={userProfile?.fullName || ''}
            />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden ml-0 md:ml-64 transition-all duration-300">
                <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between flex-shrink-0">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 focus:outline-none"><HamburgerIcon className="w-6 h-6" /></button>
                    <span className="font-bold text-slate-800">Autorank AI</span>
                    <div className="w-10"></div>
                </header>
                <main className="flex-1 overflow-y-auto relative">
                    {editingPostId ? (
                        <div className="absolute inset-0 z-50 bg-white">
                            {isLoadingEditingPost || !editingPost ? (
                                <div className="flex flex-col items-center justify-center h-full">
                                    <SparklesIcon className="w-10 h-10 text-orange-500 animate-spin" />
                                    <p className="mt-4 text-slate-500">Opening Article...</p>
                                </div>
                            ) : (
                                <ContentGenerationScreen post={editingPost} onBack={() => setEditingPost(null)} />
                            )}
                        </div>
                    ) : (
                        <div className="p-4 md:p-10">
                            {renderTab()}
                        </div>
                    )}
                </main>
            </div>
            <Chatbot />
        </div>
    );
};

export const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
        return () => subscription.unsubscribe();
    }, []);
    if (!session) return <LoginPage />;
    return <AppProvider session={session}><AppInner /></AppProvider>;
};