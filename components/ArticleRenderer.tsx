
import React, { useMemo } from 'react';
import { ScheduledPost } from '../types.ts';

interface ArticleRendererProps {
  post: ScheduledPost;
}

/**
 * Senior Developer Fix:
 * Resolves the infinite spinner by checking both naming conventions.
 * Full HTML documents are rendered via iframe srcDoc for style isolation.
 * Automatically replaces [IMAGE_X] placeholders with actual images for preview.
 */
export const ArticleRenderer: React.FC<ArticleRendererProps> = ({ post }) => {
  // Check both naming conventions to prevent the 'undefined' spinner trap
  const rawHtml = (post as any).article_content || post.articleContent;

  const processedHtml = useMemo(() => {
    if (!rawHtml) return '';
    let content = rawHtml;

    // Process feature image (IMAGE_1) if it exists in old articles
    const featureImg = post.images?.featureImage;
    if (featureImg) {
        const src = featureImg.url || (featureImg.base64 ? `data:image/jpeg;base64,${featureImg.base64}` : '');
        if (src) {
            content = content.replace(/\[IMAGE_1\]/g, `<img src="${src}" alt="${featureImg.prompt || ''}" style="max-width:100%; border-radius:8px; margin:20px 0; display:block;" />`);
        }
    }

    // Process inline images (IMAGE_2+) if they exist in old articles
    if (post.images?.inlineImages) {
        post.images.inlineImages.forEach((img, idx) => {
            const placeholder = `[IMAGE_${idx + 2}]`;
            const src = img.url || (img.base64 ? `data:image/jpeg;base64,${img.base64}` : '');
            if (src) {
                content = content.replace(new RegExp(`\\${placeholder}`, 'g'), `<img src="${src}" alt="${img.prompt || ''}" style="max-width:100%; border-radius:8px; margin:20px 0; display:block;" />`);
            }
        });
    }

    return content;
  }, [rawHtml, post.images]);

  if (!post || !rawHtml) {
    if (post?.status === 'pending') {
        return (
          <div className="flex items-center justify-center p-12 text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg h-[400px]">
            <div className="flex flex-col items-center text-center">
                <p className="font-medium text-slate-500 mb-2">No content generated yet.</p>
                <p className="text-sm text-slate-400">Click the "Generate Full Article" button to create content.</p>
            </div>
          </div>
        );
    }

    return (
      <div className="flex items-center justify-center p-12 text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg h-[400px]">
        <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-medium text-slate-500">Formatting article document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <iframe
        srcDoc={processedHtml}
        title="Article Content Preview"
        style={{ width: '100%', height: '800px', border: 'none' }}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        className="w-full transition-opacity duration-500 ease-in"
      />
    </div>
  );
};
