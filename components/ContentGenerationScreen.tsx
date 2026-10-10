import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import { ScheduledPost, PostImages } from '../types.ts';
import { generateFullArticle, generateArticleImages, analyzeArticleForGEO, rewriteArticle, publishToWordPress, generateMetaData, generateSingleImage, syncFeaturedImageToWordPress } from '../services/aiService.ts';
import { uploadArticleContent } from '../utils/contentStorage.ts';
import { useApp } from '../context/AppContext.tsx';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { LinkIcon } from './icons/LinkIcon.tsx';
import { calculateArticleMetrics, ArticleMetrics } from '../utils/articleUtils.ts';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { RewriteIcon } from './icons/RewriteIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { CopyIcon } from './icons/CopyIcon.tsx';
import { DownloadIcon } from './icons/DownloadIcon.tsx';
import { RefreshIcon } from './icons/RefreshIcon.tsx';
import { toYYYYMMDD, fromYYYYMMDD } from '../utils/dateUtils.ts';
import { uploadImageFromBase64 } from '../utils/imageStorage.ts';
import { ArticleRenderer } from './ArticleRenderer.tsx';
import { GeoScoreCircularProgress } from './GeoScoreCircularProgress.tsx';

interface ContentGenerationScreenProps {
    post: ScheduledPost;
    onBack: () => void;
}

const getMetricBasedSuggestions = (metrics: ArticleMetrics | null, post: ScheduledPost): string[] => {
    const suggestions: string[] = [];
    if (!metrics || !((post as any).article_content || post.articleContent)) return suggestions;

    if (metrics.wordCount < 1000) {
        suggestions.push(`The article is short (${metrics.wordCount} words). Aim for 1000-1500 words for better comprehensiveness.`);
    }

    const density = parseFloat(metrics.keywordDensity);
    if (density < 0.8) {
        suggestions.push(`Keyword density is low (${metrics.keywordDensity}). Try to include "${post.keyword}" naturally a few more times.`);
    }

    if (metrics.headings < 4) {
        suggestions.push(`Add more H2 or H3 headings to break up long text sections.`);
    }

    if (metrics.externalLinks < 2) {
        suggestions.push("Include 2-3 links to high-authority external sites to support your claims.");
    }
    
    return suggestions;
};

export const ContentGenerationScreen: React.FC<ContentGenerationScreenProps> = ({ post, onBack }) => {
    const { selectedBusiness, cmsIntegration, updateScheduledPost, activeTab, userProfile, updateUserProfile, logActivity, isLoadingEditingPost } = useApp();
    const [metrics, setMetrics] = useState<ArticleMetrics | null>(null);
    const [lastSaved, setLastSaved] = useState<Date | null>(new Date());
    
    const currentContent = useMemo(() => {
        return (post as any).article_content || post.articleContent || '';
    }, [post]);

    const [isGeneratingText, setIsGeneratingText] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<{ value: number; text: string } | null>(null);
    const [isGeneratingImages, setIsGeneratingImages] = useState(false);
    const [isRewriting, setIsRewriting] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [advancedInstructions, setAdvancedInstructions] = useState('');
    const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
    const [isSyncingImage, setIsSyncingImage] = useState(false);
    const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const articleEditorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [localSlug, setLocalSlug] = useState('');
    const [localPublishDate, setLocalPublishDate] = useState('');
    const [localMetaTitle, setLocalMetaTitle] = useState('');
    const [localMetaDescription, setLocalMetaDescription] = useState('');

    const isTrulyPublished = post.status === 'published' && !!(post.publishedUrl || post.published_url);

    useEffect(() => {
        setLocalSlug(post.slug || '');
        setLocalMetaTitle(post.meta_title ?? post.metaTitle ?? '');
        setLocalMetaDescription(post.meta_description ?? post.metaDescription ?? '');
        if (post.publishDate) {
            setLocalPublishDate(toYYYYMMDD(new Date(post.publishDate)));
        }
    }, [post.id, post.slug, post.publishDate, post.meta_title, post.metaTitle, post.meta_description, post.metaDescription]);
    
    useEffect(() => {
        if (isEditing && articleEditorRef.current) {
            articleEditorRef.current.innerHTML = DOMPurify.sanitize(currentContent);
        }
    }, [isEditing, currentContent]);

    useEffect(() => {
        if (currentContent && post.keyword) {
            const calculatedMetrics = calculateArticleMetrics(currentContent, post.keyword);
            setMetrics(calculatedMetrics);
        } else {
            setMetrics(null);
        }
    }, [currentContent, post.keyword]);
    
    const handleUpdatePost = useCallback(async (updates: Partial<ScheduledPost>) => {
        const result = await updateScheduledPost(post.id, updates);
        if (result) {
            setLastSaved(new Date());
        }
        return result;
    }, [post.id, updateScheduledPost]);
    
    const handleSaveField = (fieldName: 'slug' | 'publishDate' | 'metaTitle' | 'metaDescription', value: string) => {
        if (isTrulyPublished && (fieldName === 'slug' || fieldName === 'publishDate')) return;

        if (fieldName === 'slug') {
            const finalValue = value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            if (post.slug !== finalValue) {
                handleUpdatePost({ slug: finalValue });
            }
        } else if (fieldName === 'publishDate') {
            const old = post.publishDate ? new Date(post.publishDate) : null;
            const isoDate = fromYYYYMMDD(value, old ? old.getHours() : 9, old ? old.getMinutes() : 0).toISOString();
            if (post.publishDate !== isoDate) {
                handleUpdatePost({ publishDate: isoDate });
            }
        } else if (fieldName === 'metaTitle') {
            if (post.meta_title !== value && post.metaTitle !== value) {
                handleUpdatePost({ meta_title: value, metaTitle: value });
            }
        } else if (fieldName === 'metaDescription') {
            if (post.meta_description !== value && post.metaDescription !== value) {
                handleUpdatePost({ meta_description: value, metaDescription: value });
            }
        }
    };

    const handleEditClick = () => setIsEditing(true);
    const handleCancelClick = () => setIsEditing(false);

    const handleSaveClick = async () => {
        if (articleEditorRef.current && selectedBusiness) {
            const newContent = DOMPurify.sanitize(articleEditorRef.current.innerHTML);
            setIsEditing(false); 
            setIsAnalyzing(true); 
            try {
                const analysis = await analyzeArticleForGEO(newContent, post.keyword);
                const meta = await generateMetaData(newContent, post.keyword, selectedBusiness);
                const contentUrl = await uploadArticleContent(newContent, post.id);

                await handleUpdatePost({
                    articleContent: newContent,
                    contentUrl: contentUrl || undefined,
                    geoScore: analysis.geoScore,
                    aiFeedback: analysis.aiFeedback,
                    metaTitle: meta.metaTitle,
                    metaDescription: meta.metaDescription,
                    ...(isTrulyPublished ? {} : { slug: meta.slug }),
                } as any);
            } catch (e) {
                console.error("Manual edit save error:", e);
                const contentUrl = await uploadArticleContent(newContent, post.id);
                await handleUpdatePost({ 
                    articleContent: newContent, 
                    contentUrl: contentUrl || undefined
                } as any);
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    const handleReanalyze = async () => {
        if (!selectedBusiness || !currentContent) return;
        setIsAnalyzing(true);
        try {
            const analysis = await analyzeArticleForGEO(currentContent, post.keyword);
            const meta = await generateMetaData(currentContent, post.keyword, selectedBusiness);
            await handleUpdatePost({
                geoScore: analysis.geoScore,
                aiFeedback: analysis.aiFeedback,
                metaTitle: meta.metaTitle,
                meta_title: meta.metaTitle,
                metaDescription: meta.metaDescription,
                meta_description: meta.metaDescription,
                ...(isTrulyPublished ? {} : { slug: meta.slug }),
            });
        } catch (e) {
            console.error("Re-analysis error:", e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGenerateMeta = async () => {
        if (!selectedBusiness || !currentContent) return;
        setIsGeneratingMeta(true);
        try {
            const meta = await generateMetaData(currentContent, post.keyword, selectedBusiness);
            setLocalMetaTitle(meta.metaTitle || '');
            setLocalMetaDescription(meta.metaDescription || '');
            setLocalSlug(meta.slug || '');
            await handleUpdatePost({ metaTitle: meta.metaTitle, meta_title: meta.metaTitle, metaDescription: meta.metaDescription, meta_description: meta.metaDescription, slug: meta.slug });
        } catch (e) {
            console.error("Meta generation error:", e);
        } finally {
            setIsGeneratingMeta(false);
        }
    };

    // one generation at a time: a second click would start a second run and use a second credit
    const generationInFlight = useRef(false);
    const runFullGenerationProcess = useCallback(async () => {
        if (!selectedBusiness || generationInFlight.current) return;
        generationInFlight.current = true;
        setIsGeneratingText(true);
        setGenerationProgress({ value: 5, text: 'Warming up the content engine...' });
        await handleUpdatePost({ status: 'generating-text' });
        
        try {
            const fullArticleData = await generateFullArticle(post.keyword, selectedBusiness, advancedInstructions, null, (p) => setGenerationProgress(p));
            console.log("Generated fullArticleData:", fullArticleData);
            
            let images: PostImages | null = null;
            if (!selectedBusiness.skipImageGeneration) {
                setGenerationProgress({ value: 70, text: 'Creating unique images...' });
                try {
                    images = await generateArticleImages(post.keyword, selectedBusiness, undefined, fullArticleData.metaTitle);
                } catch (e) { console.error("Image generation failed", e); }
            } else {
                setGenerationProgress({ value: 85, text: 'Finalizing text content...' });
            }
            
            setGenerationProgress({ value: 95, text: 'Saving to storage...' });
            const contentUrl = await uploadArticleContent(fullArticleData.articleContent, post.id);

            await handleUpdatePost({ 
                articleContent: fullArticleData.articleContent,
                contentUrl: contentUrl || undefined,
                geoScore: fullArticleData.geoScore, 
                aiFeedback: fullArticleData.aiFeedback, 
                metaTitle: fullArticleData.metaTitle, 
                metaDescription: fullArticleData.metaDescription, 
                slug: fullArticleData.slug, 
                images, 
                status: 'draft' 
            } as any);
            setGenerationProgress({ value: 100, text: 'Generation successful!' });
        } catch (e) {
            console.error("Generation process failed:", e);
            alert((e as any)?.message || "Failed to generate article. Please try again.");
            await handleUpdatePost({ status: 'scheduled', publishAttempts: 0 } as any);
        } finally {
            generationInFlight.current = false;
            setIsGeneratingText(false);
            setGenerationProgress(null);
        }
    }, [selectedBusiness, post.keyword, advancedInstructions, handleUpdatePost]);

    const handleRewrite = useCallback(async () => {
        if (!currentContent || !selectedBusiness) return;
        setIsRewriting(true);
        try {
            const feedback = [...(post.aiFeedback || [])];
            if (advancedInstructions.trim()) feedback.unshift(`User instruction: ${advancedInstructions.trim()}`);
            
            const rewrittenData = await rewriteArticle(currentContent, post.keyword, feedback, selectedBusiness);
            const analysis = await analyzeArticleForGEO(rewrittenData.articleContent, post.keyword);
            const contentUrl = await uploadArticleContent(rewrittenData.articleContent, post.id);
            
            await handleUpdatePost({ 
                articleContent: rewrittenData.articleContent, 
                contentUrl: contentUrl || undefined,
                geoScore: analysis.geoScore, 
                aiFeedback: [...(rewrittenData.qualityFeedback || []), ...(analysis.aiFeedback || [])],
                metaTitle: rewrittenData.metaTitle,
                metaDescription: rewrittenData.metaDescription,
                slug: rewrittenData.slug
            } as any);
            logActivity(`Rewrote article: ${post.keyword}`, 'success');
        } catch (e) {
            console.error("Rewrite failed:", e);
            alert(`Rewrite failed: ${(e as any)?.message || 'Unknown error'}`);
        } finally {
            setIsRewriting(false);
        }
    }, [currentContent, post.keyword, post.aiFeedback, advancedInstructions, selectedBusiness, handleUpdatePost, logActivity]);

    const handlePublish = useCallback(async () => {
        if (!currentContent || !cmsIntegration) return;
        setIsPublishing(true);
        try {
            const postToPublish = {
                ...post,
                metaTitle: localMetaTitle,
                meta_title: localMetaTitle,
                metaDescription: localMetaDescription,
                meta_description: localMetaDescription,
                slug: localSlug
            };
            const result = await publishToWordPress(cmsIntegration, { ...postToPublish, articleContent: currentContent }, selectedBusiness);
            await handleUpdatePost({ publishedUrl: result.url, published_url: result.url, slug: result.slug, wpPostId: result.wpPostId, status: 'published', metaTitle: localMetaTitle, meta_title: localMetaTitle, metaDescription: localMetaDescription, meta_description: localMetaDescription } as any);
            logActivity(`Published to WP: ${post.keyword}`, 'success');
        } catch (error: any) {
            alert(`Publishing failed: ${error.message || 'Unknown error'}`);
        } finally {
            setIsPublishing(false);
        }
    }, [post, currentContent, cmsIntegration, handleUpdatePost, logActivity, localMetaTitle, localMetaDescription, localSlug]);

    const handleSyncImage = async () => {
        if (!cmsIntegration || !post.images?.featureImage) {
            alert("Connect a CMS and ensure a featured image exists first.");
            return;
        }
        if (!post.slug) {
            alert("Please set a slug (URL path) first so we know which WordPress post to attach this image to.");
            return;
        }
        setIsSyncingImage(true);
        try {
            const success = await syncFeaturedImageToWordPress(cmsIntegration, post);
            if (success) {
                alert("Successfully synced featured image to WordPress post!");
            } else {
                alert("Sync failed. Check your CMS settings or ensure the post exists on WordPress with the matching slug: " + post.slug);
            }
        } catch (e) {
            console.error(e);
            alert("An error occurred during sync.");
        } finally {
            setIsSyncingImage(false);
        }
    };

    const handleRegenerateFeatureImage = useCallback(async () => {
        if (!post.keyword || !selectedBusiness) return;
        setIsGeneratingImages(true);
        try {
            const base64 = await generateSingleImage(post.metaTitle || post.keyword, post.keyword, selectedBusiness);
            const url = await uploadImageFromBase64(base64, 'manual');
            const updatedImages: PostImages = { ...post.images, featureImage: { url: url || undefined, base64: url ? undefined : base64, prompt: post.keyword } };
            await handleUpdatePost({ images: updatedImages });
        } finally {
            setIsGeneratingImages(false);
        }
    }, [post, selectedBusiness, handleUpdatePost]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const url = await uploadImageFromBase64(base64, 'manual');
                const updatedImages: PostImages = { ...post.images, featureImage: { url: url || undefined, base64: url ? undefined : base64, prompt: file.name } };
                await handleUpdatePost({ images: updatedImages });
            };
            reader.readAsDataURL(file);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => alert("Copied!"));
    };

    const featureImageSrc = post.images?.featureImage?.url || (post.images?.featureImage?.base64 ? `data:image/jpeg;base64,${post.images.featureImage.base64}` : null);
    const allSuggestions = useMemo(() => [...(post.aiFeedback || []), ...getMetricBasedSuggestions(metrics, post)], [post.aiFeedback, metrics, post]);

    // generating in another tab, or a run that was interrupted (tab closed mid-way): the status stays "generating"
    const orphanedGeneration = (post.status === 'generating-text' || post.status === 'brief-generating') && !isGeneratingText && !isLoadingEditingPost;
    if (orphanedGeneration) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-stone-50">
                <h2 className="font-serif text-[26px] leading-tight text-stone-900">This article is still marked as generating</h2>
                <p className="text-stone-500 mt-2 max-w-lg">It may be running in another tab, or the run was interrupted (for example the page was closed). If nothing is running, reset it and generate again.</p>
                <div className="mt-6 flex gap-3">
                    <button onClick={onBack} className="rounded-lg border border-stone-300 px-5 py-2.5 font-semibold text-stone-700 hover:bg-stone-100">Back</button>
                    <button onClick={() => handleUpdatePost({ status: 'draft' })} className="rounded-lg bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600">Reset and try again</button>
                </div>
            </div>
        );
    }

    if (post.status === 'generating-text' || post.status === 'brief-generating' || isLoadingEditingPost) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-stone-50">
                <SparklesIcon className="w-12 h-12 text-brand-500 mb-4 animate-spin" />
                <h2 className="font-serif text-[26px] leading-tight text-stone-900">{isLoadingEditingPost ? 'Opening Article...' : 'Generating Content...'}</h2>
                <p className="text-stone-500 mt-2">{generationProgress?.text || 'Connecting to brain...'}</p>
                {isLoadingEditingPost && <button onClick={onBack} className="mt-6 rounded-lg border border-stone-300 px-5 py-2 font-semibold text-stone-700 hover:bg-stone-100">Back</button>}
            </div>
        );
    }

    // not written yet (a scheduled post, or a draft created from the planner): offer to generate it
    if (!currentContent && (post.status === 'scheduled' || post.status === 'draft')) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 bg-stone-50">
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 text-center max-w-2xl">
                    <h1 className="text-4xl font-extrabold text-stone-900 mb-6">{post.keyword}</h1>
                    <p className="text-stone-600 mb-10">This article hasn't been written yet. Generate it now to start your GEO strategy.</p>
                    <button onClick={() => runFullGenerationProcess()} disabled={isGeneratingText} className="disabled:opacity-60 disabled:cursor-not-allowed bg-brand-500 text-white px-10 py-4 rounded-xl font-bold shadow-lg hover:bg-brand-600 transition-all">Generate Article with AI</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-stone-100 relative">
             <header className="bg-white border-b border-stone-200/80 px-6 py-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                        <button onClick={onBack} className="text-stone-500 hover:text-stone-800">&larr; Back</button>
                        <span className="text-stone-300">/</span>
                        <span className="font-medium text-stone-800 truncate max-w-xs">{post.keyword}</span>
                    </div>
                     <div className="flex items-center gap-4">
                        <span className="text-[10px] text-stone-400">Last saved: {lastSaved?.toLocaleTimeString()}</span>
                        <button onClick={() => handleUpdatePost({})} className="text-sm font-medium text-stone-600 hover:text-brand-600">Save Changes</button>
                    </div>
                </div>
                {isTrulyPublished && (
                    <div className="mt-3 bg-stone-50 border border-stone-200 rounded-lg p-2 flex items-center justify-between text-sm">
                         <div className="flex items-center gap-2">
                             <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">Published</span>
                             <a href={post.publishedUrl || post.published_url} target="_blank" rel="noopener noreferrer" className="text-stone-600 truncate hover:underline">{post.publishedUrl || post.published_url}</a>
                         </div>
                         <button onClick={() => copyToClipboard((post.publishedUrl || post.published_url)!)} className="flex items-center gap-1.5 bg-white border border-stone-300 rounded-md px-2 py-1 text-stone-700 hover:bg-stone-100 transition-colors">
                            <CopyIcon className="w-4 h-4"/> Copy URL
                         </button>
                    </div>
                )}
            </header>

            <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                <div className="flex-grow p-4 md:p-6 overflow-y-auto">
                    <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 md:p-12 mx-auto max-w-5xl min-h-full">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                {isTrulyPublished && (post.publishedUrl || post.published_url) && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">Live</span>
                                        <a href={post.publishedUrl || post.published_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-md">
                                            {post.publishedUrl || post.published_url}
                                        </a>
                                    </div>
                                )}
                            </div>
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <button onClick={handleCancelClick} className="bg-stone-100 px-4 py-2 text-sm rounded-lg">Cancel</button>
                                    <button onClick={handleSaveClick} className="bg-brand-500 text-white px-4 py-2 text-sm rounded-lg">Save Changes</button>
                                </div>
                            ) : (
                                <button onClick={handleEditClick} className="bg-stone-800 text-white px-4 py-2 text-sm rounded-lg flex items-center gap-2 shadow-sm">
                                    <RefreshIcon className="w-4 h-4" /> Manual Edit
                                </button>
                            )}
                        </div>
                        {isEditing ? (
                            <div ref={articleEditorRef} contentEditable className="prose prose-slate max-w-none p-4 bg-stone-50 border rounded-md focus:outline-none min-h-[500px]" />
                        ) : (
                            <ArticleRenderer post={post} />
                        )}
                    </div>
                </div>

                <aside className="w-full lg:w-80 bg-white border-l border-stone-200/80 p-4 overflow-y-auto flex-shrink-0 flex flex-col gap-6">
                    <div className="space-y-3">
                        <button onClick={handlePublish} disabled={isPublishing} className="w-full bg-stone-900 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-colors disabled:bg-stone-300 shadow-sm">
                            <LinkIcon className="w-5 h-5" /> {isPublishing ? 'Publishing...' : isTrulyPublished ? 'Update Live Article' : 'Publish to WordPress'}
                        </button>
                    </div>

                    {/* GEO Score */}
                    <div className="bg-stone-50 p-4 rounded-lg border border-stone-200">
                        <h4 className="text-sm font-bold text-stone-800 mb-3">GEO Score</h4>
                        <div className="flex items-center justify-center py-2">
                            {post.geo_score != null ? (
                                <GeoScoreCircularProgress score={post.geo_score} size={90} strokeWidth={9} />
                            ) : post.geoScore != null ? (
                                <GeoScoreCircularProgress score={post.geoScore} size={90} strokeWidth={9} />
                            ) : (
                                <div className="w-20 h-20 rounded-full border-4 border-stone-200 flex items-center justify-center">
                                    <span className="text-lg font-bold text-stone-300">—</span>
                                </div>
                            )}
                        </div>
                        {!post.geo_score && !post.geoScore && currentContent && (
                            <button onClick={handleReanalyze} disabled={isAnalyzing} className="w-full mt-2 text-[10px] font-bold bg-brand-50 border border-brand-200 text-brand-600 py-1.5 rounded-lg hover:bg-brand-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                                <SparklesIcon className="w-3 h-3" />
                                {isAnalyzing ? 'Analyzing...' : 'Analyze GEO Score'}
                            </button>
                        )}
                    </div>

                    <div className="bg-stone-50 p-4 rounded-lg border border-stone-200">
                        <h4 className="text-sm font-bold text-stone-800 mb-4">Featured Image</h4>
                        {featureImageSrc ? (
                            <div className="space-y-2">
                                <div className="group relative">
                                    <img src={featureImageSrc} className="w-full rounded-lg border shadow-sm" alt="Featured Visual" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                                        <button onClick={() => handleUpdatePost({ images: { ...post.images, featureImage: undefined } })} className="p-2 bg-white rounded-full text-red-500 shadow-lg hover:bg-red-50 transition-all"><TrashIcon className="w-5 h-5" /></button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                     <button onClick={() => window.open(featureImageSrc, '_blank')} className="w-full bg-white border text-[10px] font-bold py-1.5 rounded hover:bg-stone-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm"><DownloadIcon className="w-3 h-3" /> Download</button>
                                     {cmsIntegration && (
                                         <button 
                                            onClick={handleSyncImage} 
                                            disabled={isSyncingImage || !post.slug}
                                            className="w-full bg-stone-800 text-white text-[10px] font-bold py-1.5 rounded hover:bg-stone-900 transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:bg-stone-400"
                                            title={!post.slug ? "Set a slug below to enable syncing" : ""}
                                         >
                                            <RefreshIcon className={`w-3 h-3 ${isSyncingImage ? 'animate-spin' : ''}`} /> 
                                            {isSyncingImage ? 'Syncing...' : 'Sync image to WordPress'}
                                         </button>
                                     )}
                                </div>
                            </div>
                        ) : (
                            <div className="w-full aspect-video bg-stone-100 border-2 border-dashed border-stone-300 rounded-lg flex flex-col items-center justify-center gap-2">
                                <p className="text-[11px] text-stone-400">No image assigned</p>
                                <div className="flex gap-2">
                                    <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold bg-white border px-3 py-1.5 rounded-md hover:bg-stone-50 shadow-sm">Upload</button>
                                    <button onClick={handleRegenerateFeatureImage} disabled={isGeneratingImages} className="text-[10px] font-bold bg-stone-800 text-white px-3 py-1.5 rounded-md hover:bg-stone-900 shadow-sm disabled:bg-stone-400">
                                        {isGeneratingImages ? 'Creating...' : 'AI Generate'}
                                    </button>
                                </div>
                            </div>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                    </div>

                    <div className="bg-stone-50 p-4 rounded-lg border border-stone-200">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-stone-800">Meta Settings</h4>
                            <button
                                onClick={handleGenerateMeta}
                                disabled={isGeneratingMeta || !currentContent}
                                className="flex items-center gap-1 text-[10px] font-bold text-brand-600 hover:text-brand-700 disabled:text-stone-300 transition-colors"
                            >
                                {isGeneratingMeta
                                    ? <span className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin inline-block" />
                                    : <SparklesIcon className="w-3 h-3" />
                                }
                                {isGeneratingMeta ? 'Generating...' : 'Auto-fill with AI'}
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-stone-400 block mb-1.5">Meta Title</label>
                                <input 
                                    value={localMetaTitle} 
                                    onChange={(e) => setLocalMetaTitle(e.target.value)} 
                                    onBlur={() => handleSaveField('metaTitle', localMetaTitle)} 
                                    className="w-full text-xs p-2.5 border rounded-lg focus:ring-1 focus:ring-brand-500 outline-none transition-all" 
                                    placeholder="SEO Optimized Title..."
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-stone-400 block mb-1.5">Meta Description</label>
                                <textarea 
                                    value={localMetaDescription} 
                                    onChange={(e) => setLocalMetaDescription(e.target.value)} 
                                    onBlur={() => handleSaveField('metaDescription', localMetaDescription)} 
                                    className="w-full text-xs p-2.5 border rounded-lg focus:ring-1 focus:ring-brand-500 outline-none transition-all" 
                                    rows={4} 
                                    placeholder="Brief summary for search results..."
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-stone-400 block mb-1.5">Slug (URL Path)</label>
                                <input 
                                    value={localSlug} 
                                    onChange={(e) => setLocalSlug(e.target.value)} 
                                    onBlur={() => handleSaveField('slug', localSlug)} 
                                    disabled={isTrulyPublished}
                                    className="w-full text-xs p-2.5 border rounded-lg focus:ring-1 focus:ring-brand-500 outline-none transition-all disabled:bg-stone-100 disabled:text-stone-400" 
                                    placeholder="article-url-slug"
                                />
                                {!post.slug && cmsIntegration && (
                                    <p className="text-[9px] text-brand-600 mt-1 font-medium italic">* Slug is required to sync images</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-stone-50 p-4 rounded-lg border border-stone-200">
                        <button onClick={() => setIsInstructionsOpen(prev => !prev)} className="w-full flex justify-between items-center group">
                            <h3 className="text-sm font-bold text-stone-800">Advanced Instructions</h3>
                            <ChevronDownIcon className={`w-4 h-4 text-stone-400 transition-transform ${isInstructionsOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isInstructionsOpen && (
                            <div className="mt-4 pt-4 border-t border-stone-200">
                                <textarea
                                    value={advancedInstructions}
                                    onChange={(e) => setAdvancedInstructions(e.target.value)}
                                    className="w-full text-xs p-2.5 border rounded-lg outline-none focus:ring-1 focus:ring-brand-500"
                                    rows={3}
                                    placeholder="e.g., Focus more on local Texas pricing..."
                                />
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-6 border-t border-stone-200">
                        <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">Optimization Roadmap</h4>
                        <div className="space-y-2">
                            {allSuggestions.slice(0, 3).map((item, i) => (
                                <div key={i} className="text-[11px] leading-relaxed text-stone-600 bg-brand-50/50 p-3 rounded-lg border border-brand-100 flex gap-2.5">
                                    <SparklesIcon className="w-3 h-3 text-brand-400 flex-shrink-0 mt-0.5" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleRewrite} disabled={isRewriting || !currentContent} className="w-full mt-4 bg-stone-100 border text-xs font-bold py-2 rounded-lg hover:bg-stone-200 transition-all flex items-center justify-center gap-2 text-stone-700 disabled:opacity-50">
                             <RewriteIcon className={`w-3.5 h-3.5 ${isRewriting ? 'animate-spin' : ''}`} />
                             {isRewriting ? 'Rewriting...' : 'Rewrite with AI Intelligence'}
                        </button>
                    </div>
                </aside>
            </main>
        </div>
    );
};