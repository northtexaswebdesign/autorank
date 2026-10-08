import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ScheduledPost, AppTab, PostImages } from '../types.ts';
import { Modal } from './Modal.tsx';
import { generateFullArticle, generateArticleImages, analyzeArticleForGEO, rewriteArticle, publishToWordPress, generateMetaData } from '../services/aiService.ts';
import { uploadArticleContent } from '../utils/contentStorage.ts';
import { useApp } from '../context/AppContext.tsx';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { LinkIcon } from './icons/LinkIcon.tsx';
import { calculateArticleMetrics, ArticleMetrics } from '../utils/articleUtils.ts';
import { GeoScoreCircularProgress } from './GeoScoreCircularProgress.tsx';

// Helper for rendering images into content
const renderProcessedArticle = (content: string = '', images: PostImages | null | undefined) => {
  if (!content) return '';
  let processedContent = content;
  
  if (images?.inlineImages) {
    images.inlineImages.forEach((image, index) => {
      const placeholder = new RegExp(`(?:<p>)?\\[IMAGE_${index + 2}\\](?:<\/p>)?`, 'g');
      const imageSrc = image.url || '';
      if (imageSrc) {
        processedContent = processedContent.replace(placeholder, `<img src="${imageSrc}" alt="${image.prompt}" />`);
      }
    });
  }
  
  if (images?.featureImage) {
    const placeholder = /(?:<p>)?\[IMAGE_1\](?:<\/p>)?/g;
    const imageSrc = images.featureImage.url || '';
    if (imageSrc) {
      processedContent = processedContent.replace(placeholder, `<img src="${imageSrc}" alt="${images.featureImage.prompt}" />`);
    }
  }
  
  return processedContent;
};

export const ArticleGenerationModal: React.FC<{ 
  post: ScheduledPost | null, 
  isOpen: boolean, 
  onClose: () => void, 
  setActiveTab: (tab: AppTab) => void 
}> = ({ post, isOpen, onClose, setActiveTab }) => {
  const { selectedBusiness, cmsIntegration, updateScheduledPost } = useApp();

  const [localPost, setLocalPost] = useState<ScheduledPost | null>(post);
  const lastPostId = useRef<string | null>(post?.id || null);

  useEffect(() => {
    if (!post || post.id === lastPostId.current) return;
    setLocalPost(post);
    lastPostId.current = post.id;
  }, [post]);

  const rawContent = useMemo(() => {
    if (!localPost) return '';
    return (localPost as any).article_content || localPost.articleContent || '';
  }, [localPost]);

  const [metrics, setMetrics] = useState<ArticleMetrics | null>(null);
  useEffect(() => {
    if (rawContent && localPost?.keyword) {
      setMetrics(calculateArticleMetrics(rawContent, localPost.keyword));
    } else {
      setMetrics(null);
    }
  }, [rawContent, localPost?.keyword]);

  const [instructions, setInstructions] = useState('');
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);

  // Editable meta fields
  const [metaTitle, setMetaTitle] = useState(localPost?.meta_title ?? localPost?.metaTitle ?? '');
  const [metaDescription, setMetaDescription] = useState(localPost?.meta_description ?? localPost?.metaDescription ?? '');
  const [slug, setSlug] = useState(localPost?.slug || '');

  // Sync meta fields when localPost changes
  useEffect(() => {
    if (localPost) {
      setMetaTitle(localPost.meta_title ?? localPost.metaTitle ?? '');
      setMetaDescription(localPost.meta_description ?? localPost.metaDescription ?? '');
      setSlug(localPost.slug || '');
    }
  }, [localPost?.id, localPost?.meta_title, localPost?.metaTitle, localPost?.meta_description, localPost?.metaDescription, localPost?.slug]);

  const handleGenerateText = async () => {
    if (!localPost || !selectedBusiness) return;
    setIsGeneratingText(true);
    try {
      const fullData = await generateFullArticle(localPost.keyword, selectedBusiness, instructions);
      let images = null;
      if (!selectedBusiness.skipImageGeneration) {
          try { 
              images = await generateArticleImages(localPost.keyword, selectedBusiness); 
          } catch (imageError) { 
              console.error("Image generation failed:", imageError); 
          }
      }

      const contentUrl = await uploadArticleContent(fullData.articleContent, localPost.id);

      const updates: Partial<ScheduledPost> = { 
          articleContent: fullData.articleContent, // Keep local for immediate rendering
          contentUrl: contentUrl || undefined,
          status: 'draft' as const, 
          geoScore: fullData.geoScore, 
          aiFeedback: fullData.aiFeedback, 
          metaTitle: fullData.metaTitle, 
          metaDescription: fullData.metaDescription, 
          slug: fullData.slug,
          images 
      };
      
      const updatedPost = { ...localPost, ...updates } as ScheduledPost;
      setLocalPost(updatedPost);
      setMetaTitle(fullData.metaTitle || '');
      setMetaDescription(fullData.metaDescription || '');
      setSlug(fullData.slug || '');
      await updateScheduledPost(localPost.id, updates);
    } catch (e) {
      console.error("Failed to generate article text:", e);
      alert(`Failed to generate article. Please try again.`);
    } finally {
      setIsGeneratingText(false);
    }
  };

  // AI auto-fill meta title + description
  const handleGenerateMeta = async () => {
    if (!localPost || !rawContent || !selectedBusiness) return;
    setIsGeneratingMeta(true);
    try {
      const meta = await generateMetaData(rawContent, localPost.keyword, selectedBusiness);
      setMetaTitle(meta.metaTitle || '');
      setMetaDescription(meta.metaDescription || '');
      setSlug(meta.slug || '');
      const updates = { metaTitle: meta.metaTitle, meta_title: meta.metaTitle, metaDescription: meta.metaDescription, meta_description: meta.metaDescription, slug: meta.slug };
      setLocalPost(prev => prev ? { ...prev, ...updates } : prev);
      await updateScheduledPost(localPost.id, updates);
    } catch (e) {
      console.error("Failed to generate meta:", e);
    } finally {
      setIsGeneratingMeta(false);
    }
  };

  // Save meta edits on blur
  const handleMetaBlur = async () => {
    if (!localPost) return;
    const updates = { metaTitle, meta_title: metaTitle, metaDescription, meta_description: metaDescription, slug };
    setLocalPost(prev => prev ? { ...prev, ...updates } : prev);
    await updateScheduledPost(localPost.id, updates);
  };

  const handlePublish = async () => {
    if (!localPost || !rawContent || !cmsIntegration) return;
    setIsPublishing(true);
    try {
      const postToPublish = { ...localPost, metaTitle, meta_title: metaTitle, metaDescription, meta_description: metaDescription, slug };
      const contentWithImages = renderProcessedArticle(rawContent, localPost.images);
      const result = await publishToWordPress(cmsIntegration, { ...postToPublish, articleContent: contentWithImages });
      const updates = { publishedUrl: result.url, published_url: result.url, slug: result.slug, status: 'published' as const };
      setLocalPost({ ...localPost, ...updates });
      await updateScheduledPost(localPost.id, updates);
    } catch (error) {
      alert(`Publishing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const renderedArticleHTML = useMemo(() =>
    renderProcessedArticle(rawContent, localPost?.images),
    [rawContent, localPost?.images]);

  const geoScore = localPost?.geo_score ?? localPost?.geoScore ?? null;

  if (!localPost) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={localPost.keyword}>
      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[600px]">
        
        {/* Main Content Area */}
        <div className="flex-grow border border-slate-200 rounded-lg overflow-hidden bg-white shadow-inner flex flex-col">
          {!rawContent && !isGeneratingText ? (
            <div className="flex-grow flex flex-col items-center justify-center p-12 text-center">
              <SparklesIcon className="w-16 h-16 text-slate-200 mb-4" />
              <h3 className="text-xl font-bold text-slate-800">Ready to Generate?</h3>
              <p className="text-slate-500 max-w-sm mb-6">Start your GEO strategy by generating a professional, search-ready article for this keyword.</p>
              <button 
                onClick={handleGenerateText} 
                disabled={isGeneratingText}
                className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-orange-700 active:scale-95 transition-all"
              >
                Generate Article with AI
              </button>
            </div>
          ) : isGeneratingText ? (
             <div className="flex-grow flex flex-col items-center justify-center p-12 text-center">
                <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <h3 className="text-xl font-bold text-slate-800">Writing Content...</h3>
                <p className="text-slate-500">This usually takes about 30 seconds.</p>
             </div>
          ) : (
            <iframe
              srcDoc={renderedArticleHTML}
              title="Article Content Preview"
              className="flex-grow w-full border-none"
              style={{ minHeight: '600px', height: '100%' }}
              sandbox="allow-popups allow-scripts allow-same-origin"
            />
          )}
        </div>

        {/* Sidebar Controls */}
        <aside className="w-full lg:w-80 flex flex-col gap-4">

          {/* GEO Score */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">GEO Score</h3>
            {geoScore !== null ? (
              <div className="flex items-center justify-center">
                <GeoScoreCircularProgress score={geoScore} size={80} strokeWidth={8} />
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-4 border-slate-100 flex items-center justify-center">
                  <span className="text-lg font-bold text-slate-300">—</span>
                </div>
              </div>
            )}
          </div>

          {/* Featured Image */}
          {localPost.images?.featureImage && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Featured Image</h3>
              <img
                src={localPost.images.featureImage.url || (localPost.images.featureImage.base64 ? `data:image/jpeg;base64,${localPost.images.featureImage.base64}` : '')}
                alt={localPost.images.featureImage.prompt || localPost.keyword}
                className="w-full rounded-lg object-cover"
                style={{ maxHeight: '140px' }}
              />
              <p className="text-xs text-slate-400 mt-2 italic line-clamp-2">{localPost.images.featureImage.prompt}</p>
            </div>
          )}

          {/* Meta Settings */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Meta Settings</h3>
              <button
                onClick={handleGenerateMeta}
                disabled={isGeneratingMeta || !rawContent}
                title="Auto-fill with AI"
                className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:text-slate-300 transition-colors"
              >
                {isGeneratingMeta ? (
                  <span className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <SparklesIcon className="w-3.5 h-3.5" />
                )}
                {isGeneratingMeta ? 'Generating...' : 'Auto-fill with AI'}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 font-medium">Meta Title</label>
              <input
                type="text"
                value={metaTitle}
                onChange={e => setMetaTitle(e.target.value)}
                onBlur={handleMetaBlur}
                placeholder="SEO Optimized Title..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
              />
              <span className={`text-xs mt-0.5 ${metaTitle.length > 60 ? 'text-red-400' : 'text-slate-400'}`}>
                {metaTitle.length}/60 characters
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 font-medium">Meta Description</label>
              <textarea
                value={metaDescription}
                onChange={e => setMetaDescription(e.target.value)}
                onBlur={handleMetaBlur}
                placeholder="Brief summary for search results..."
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition resize-none"
              />
              <span className={`text-xs mt-0.5 ${metaDescription.length > 160 ? 'text-red-400' : 'text-slate-400'}`}>
                {metaDescription.length}/160 characters
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 font-medium">Slug (URL Path)</label>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                onBlur={handleMetaBlur}
                placeholder="url-friendly-slug"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition font-mono"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 mt-auto">
            {rawContent && (
              <button
                onClick={handleGenerateText}
                disabled={isGeneratingText}
                className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                <SparklesIcon className="w-4 h-4" />
                {isGeneratingText ? 'Regenerating...' : 'Regenerate Article'}
              </button>
            )}

            <button 
              onClick={handlePublish}
              disabled={isPublishing || !rawContent || !cmsIntegration}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors disabled:bg-slate-300 shadow-md"
            >
              {isPublishing ? 'Publishing...' : 'Publish to WordPress'}
              <LinkIcon className="w-4 h-4" />
            </button>
            
            {(localPost.publishedUrl || localPost.published_url) && (localPost.publishedUrl || localPost.published_url) !== '#' && (
              <a 
                href={localPost.publishedUrl || localPost.published_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full bg-white border border-slate-300 text-slate-700 py-3 rounded-lg font-bold text-center hover:bg-slate-50 transition-colors"
              >
                View Live Post
              </a>
            )}
          </div>
        </aside>
      </div>
    </Modal>
  );
};