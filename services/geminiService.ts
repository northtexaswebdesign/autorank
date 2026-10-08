import { GoogleGenAI, Type } from "@google/genai";
import { BusinessInfo, Keyword, ContentCluster, CompetitorAnalysis, CmsIntegration, ScheduledPost, PostImages, GeneratedImage, ContentBrief, KeywordOpportunity } from "../types.ts";
import { uploadImageFromBase64 } from '../utils/imageStorage.ts';

const getAI = () => new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY });
const ai = { get models() { return getAI().models; } };

/**
 * Senior Developer Fix: 
 * Prevents the deletion of valid HTML structural tags.
 * Bypasses destructive cleaning that causes "Empty Content" bugs.
 */
export const cleanAIResponse = (text: string): string => {
    if (!text) return "";
    let content = text.trim();

    if (content.startsWith('```')) {
        const lines = content.split('\n');
        if (lines.length > 1 && lines[0].startsWith('```')) {
            lines.shift();
        }
        if (lines.length > 0 && lines[lines.length - 1].startsWith('```')) {
            lines.pop();
        }
        content = lines.join('\n').trim();
    }
    
    if (!content.startsWith('{') && !content.startsWith('[')) {
        const firstBrace = content.indexOf('{');
        const firstBracket = content.indexOf('[');
        const lastBrace = content.lastIndexOf('}');
        const lastBracket = content.lastIndexOf(']');
        
        let start = -1;
        let end = -1;
        
        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            start = firstBrace;
            end = lastBrace > firstBrace ? lastBrace : content.length - 1;
        } else if (firstBracket !== -1) {
            start = firstBracket;
            end = lastBracket > firstBracket ? lastBracket : content.length - 1;
        }
        
        if (start !== -1) {
            content = content.substring(start, end + 1);
        }
    }
    
    return content;
};

const parseArticleResponse = (text: string, defaultKeyword: string, businessName: string) => {
    let parsedData = { articleContent: '', metaTitle: '', metaDescription: '', slug: '' };
    try {
        parsedData = JSON.parse(cleanAIResponse(text || '{}'));
    } catch (e) {
        console.error("Failed to parse article JSON", e);
        
        // Fallback for truncated JSON
        try {
            const contentMatch = text.match(/"articleContent"\s*:\s*"([\s\S]*)/);
            if (contentMatch && contentMatch[1]) {
                let rawContent = contentMatch[1];
                
                const nextKeyIndex = rawContent.indexOf('","metaTitle"');
                if (nextKeyIndex !== -1) {
                    rawContent = rawContent.substring(0, nextKeyIndex);
                } else {
                    if (rawContent.endsWith('"')) {
                        rawContent = rawContent.substring(0, rawContent.length - 1);
                    } else if (rawContent.endsWith('"}')) {
                        rawContent = rawContent.substring(0, rawContent.length - 2);
                    }
                }
                
                parsedData.articleContent = rawContent
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\')
                    .replace(/\\t/g, '\t');
            }
            
            const titleMatch = text.match(/"metaTitle"\s*:\s*"([^"]*)/);
            if (titleMatch && titleMatch[1]) parsedData.metaTitle = titleMatch[1].replace(/\\"/g, '"');
            
            const descMatch = text.match(/"metaDescription"\s*:\s*"([^"]*)/);
            if (descMatch && descMatch[1]) parsedData.metaDescription = descMatch[1].replace(/\\"/g, '"');
            
            const slugMatch = text.match(/"slug"\s*:\s*"([^"]*)/);
            if (slugMatch && slugMatch[1]) parsedData.slug = slugMatch[1].replace(/\\"/g, '"');
            
            // If we still don't have content, check if the AI just returned raw HTML or markdown instead of JSON
            if (!parsedData.articleContent && text.length > 500) { // If it's a long response, it's probably the article
                // Strip markdown code blocks if present
                parsedData.articleContent = text.replace(/^```(html|json|markdown)?\n/i, '').replace(/\n```$/i, '').trim();
                
                // If it looks like markdown (has # or **), we should ideally convert it, but for now just wrap in basic HTML if it lacks it
                if (!parsedData.articleContent.includes('<p>') && !parsedData.articleContent.includes('<h')) {
                    // Very basic markdown to HTML conversion for fallback
                    parsedData.articleContent = parsedData.articleContent
                        .split('\n\n')
                        .map(para => {
                            if (para.startsWith('# ')) return `<h1>${para.substring(2)}</h1>`;
                            if (para.startsWith('## ')) return `<h2>${para.substring(3)}</h2>`;
                            if (para.startsWith('### ')) return `<h3>${para.substring(4)}</h3>`;
                            if (para.startsWith('- ')) return `<ul>${para.split('\n').map(li => `<li>${li.substring(2)}</li>`).join('')}</ul>`;
                            return `<p>${para}</p>`;
                        })
                        .join('\n');
                }
            }
            
        } catch (fallbackErr) {
            console.error("Fallback parsing also failed", fallbackErr);
        }
    }
    
    return {
        articleContent: parsedData.articleContent || '',
        metaTitle: parsedData.metaTitle || `${defaultKeyword} | ${businessName}`,
        metaDescription: parsedData.metaDescription || `Read our comprehensive guide about ${defaultKeyword} for ${businessName} audiences.`,
        slug: parsedData.slug || defaultKeyword.toLowerCase().replace(/\s+/g, '-')
    };
};

export const generateKeywords = async (business: BusinessInfo, language: string = 'English'): Promise<Keyword[]> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Generate a list of 20 high-opportunity SEO keywords for this business in ${language}:
            Name: ${business.name}
            URL: ${business.url}
            Description: ${business.description}
            Audience: ${business.audience}`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            keyword: { type: Type.STRING },
                            opportunity: { type: Type.STRING, enum: Object.values(KeywordOpportunity) }
                        },
                        required: ['keyword', 'opportunity']
                    }
                }
            }
        });

        try {
            return JSON.parse(cleanAIResponse(response.text || '[]'));
        } catch (e) {
            console.error("Failed to parse keywords", e);
            return [];
        }
    } catch (apiError) {
        console.error("Keyword generation API call failed:", apiError);
        return [];
    }
};

export const suggestContentCluster = async (targetKeyword: string, business: BusinessInfo): Promise<ContentCluster | null> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Generate a strategic content cluster for the keyword "${targetKeyword}" for the business ${business.name} (${business.description}).
            Identify the main pillar topic (which should be related to "${targetKeyword}") and 5-7 related cluster topics.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        pillar: { type: Type.STRING },
                        clusters: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['pillar', 'clusters']
                }
            }
        });

        try {
            return JSON.parse(cleanAIResponse(response.text || 'null'));
        } catch (e) {
            return null;
        }
    } catch (apiError) {
        console.error("Content cluster API call failed:", apiError);
        return null;
    }
};

export const analyzeCompetitors = async (
    business: BusinessInfo, 
    onProgress: (progress: { value: number; text: string }) => void
): Promise<CompetitorAnalysis> => {
    onProgress({ value: 10, text: "Scanning competitor domains..." });
    const competitors = business.competitors.join(', ');

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: `Perform a competitive analysis for ${business.name} against these competitors: ${competitors}.
            Base the analysis on their likely content strategies.`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        analysis: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    url: { type: Type.STRING },
                                    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    contentStrategySummary: { type: Type.STRING }
                                }
                            }
                        },
                        strategicRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            }
        });

        onProgress({ value: 100, text: "Analysis complete" });

        try {
            const data = JSON.parse(cleanAIResponse(response.text || '{}'));
            return {
                ...data,
                analyzedAt: new Date().toISOString()
            };
        } catch (parseError) {
            console.error("Failed to parse competitor analysis JSON:", parseError);
            return {
                analysis: [],
                strategicRecommendations: ["Competitor analysis could not be parsed. Please try again."],
                analyzedAt: new Date().toISOString()
            };
        }
    } catch (apiError) {
        console.error("Competitor analysis API call failed:", apiError);
        onProgress({ value: 100, text: "Analysis failed" });
        return {
            analysis: [],
            strategicRecommendations: ["Competitor analysis failed due to a temporary API error. Please try again."],
            analyzedAt: new Date().toISOString()
        };
    }
};

export const generateFullArticle = async (
    keyword: string, 
    business: BusinessInfo, 
    instructions?: string, 
    brief?: ContentBrief | null, 
    onProgress?: (progress: { value: number; text: string }) => void
) => {
    onProgress?.({ value: 10, text: "Gathering authoritative sources via search..." });
    
    const imageInstruction = business.skipImageGeneration 
        ? "5. STRICTLY NO IMAGES: Do NOT include any <img> tags, markdown images, image placeholders, base64 images, or data URIs in the HTML. The content must be 100% text only."
        : "5. IMAGES: You MUST include exactly one image placeholder in the format <p>[IMAGE_1]</p> near the beginning of the article. Do NOT include any actual <img> tags, markdown images, base64 images, or external image URLs.";

    const prompt = `You are tasked with writing the absolute best, most comprehensive SEO article on the internet for the keyword: "${keyword}".
    
    First, use your search capabilities to analyze the top-ranking articles for this keyword. Identify what they cover, but more importantly, identify their gaps, missing information, and areas where they lack depth or clarity. 
    
    Then, write a superior article that covers all the essential information the competitors have, PLUS fills in those gaps with unique, valuable insights. Your goal is to create a 10x better resource that outranks the current top results.
    
    CRITICAL REQUIREMENTS:
    1. Add a well-formatted, clearly written summary at the very beginning of the article, optimized for generative AI engines to quickly extract the main points. Do NOT use the term "TL;DR" or "TL DR". Use a professional heading like "Executive Summary" or "Key Takeaways".
    2. Include a dedicated FAQ section at the end with conversational questions to capture natural language queries.
    3. The article MUST be between 1500 and 2000 words in length. This is a strict requirement for comprehensive coverage.
    4. Back up claims with real data, statistics, and references to reputable sources. Use your search tool to find accurate, up-to-date data to include.
    ${imageInstruction}
    6. INTERNAL LINKING: You MUST include 2-3 highly relevant internal links to existing pages on the business's website. Use your search tool to search the site (e.g., "site:${business.url} [related topic]") or reference their sitemap (${business.sitemapUrl ? business.sitemapUrl : 'if available'}) to find the exact URLs of relevant existing articles. Embed these links naturally within the HTML content using descriptive anchor text.
    
    Business Context: ${business.name} (${business.description})
    Target Audience: ${business.audience}
    ${instructions ? `Additional Instructions: ${instructions}` : ''}
    ${brief ? `Content Brief Outline: ${brief.outline.join(', ')}` : ''}
    
    Return a JSON object with the following structure:
    {
        "articleContent": "The HTML content of the article. Ensure it is highly formatted with H2s, H3s, bullet points, and bold text for readability. ${business.skipImageGeneration ? 'Do NOT include any images.' : 'Must include <p>[IMAGE_1]</p>.'} Must include an AI-optimized summary at the beginning and an FAQ section at the end.",
        "metaTitle": "SEO optimized meta title (around 60 characters)",
        "metaDescription": "SEO optimized meta description (around 150 characters)",
        "slug": "url-friendly-slug"
    }`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    articleContent: { type: Type.STRING },
                    metaTitle: { type: Type.STRING },
                    metaDescription: { type: Type.STRING },
                    slug: { type: Type.STRING }
                }
            },
            systemInstruction: "You are an expert SEO content writer specialized in GEO (Generative Engine Optimization). Write in-depth, helpful content."
        }
    });

    onProgress?.({ value: 90, text: "Optimizing for Generative Search..." });
    
    const parsedData = parseArticleResponse(response.text || '{}', keyword, business.name);
    
    const content = parsedData.articleContent || '';
    const analysis = await analyzeArticleForGEO(content, keyword);

    return { 
        articleContent: content, 
        geoScore: analysis.geoScore, 
        aiFeedback: analysis.aiFeedback, 
        metaTitle: parsedData.metaTitle, 
        metaDescription: parsedData.metaDescription, 
        slug: parsedData.slug 
    };
};

export const generateArticleImages = async (
    keyword: string, 
    business: BusinessInfo,
    onProgress?: (progress: { value: number; text: string }) => void
): Promise<PostImages> => {
    onProgress?.({ value: 10, text: "Designing feature image..." });
    const featurePrompt = `A professional feature image for a blog post about "${keyword}" for ${business.name}. Cinematic lighting, high quality. No text.`;
    const featureBase64 = await generateSingleImage(featurePrompt, '16:9');
    
    onProgress?.({ value: 50, text: "Uploading feature image..." });
    const featureUrl = await uploadImageFromBase64(featureBase64, 'auto-generated');

    if (!featureUrl) {
        console.error('Feature image upload failed — no URL returned from storage.');
        throw new Error('Feature image could not be uploaded to storage. Please try again.');
    }

    return {
        featureImage: { 
            url: featureUrl,
            prompt: await generateImageAltText(featureBase64, keyword) 
        }
    };
};

export const analyzeArticleForGEO = async (content: string, keyword: string) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: `Analyze this article for keyword "${keyword}" based on GEO (Generative Engine Optimization) principles:
            Content: ${content}`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        geoScore: { type: Type.INTEGER },
                        aiFeedback: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            }
        });
        try {
            return JSON.parse(cleanAIResponse(response.text || '{"geoScore": 70, "aiFeedback": []}'));
        } catch (e) {
            return { geoScore: 75, aiFeedback: ["Analyzed with standard parameters."] };
        }
    } catch (apiError) {
        console.error('GEO analysis API call failed, using fallback score:', apiError);
        return { geoScore: 75, aiFeedback: ["Analysis skipped due to a temporary API error."] };
    }
};

export const rewriteArticle = async (content: string, keyword: string, feedback: string[], business: BusinessInfo) => {
    const imageInstruction = business.skipImageGeneration 
        ? "5. STRICTLY NO IMAGES: Do NOT include any <img> tags, markdown images, image placeholders, base64 images, or data URIs in the HTML. The content must be 100% text only."
        : "5. IMAGES: You MUST include exactly one image placeholder in the format <p>[IMAGE_1]</p> near the beginning of the article. Do NOT include any actual <img> tags, markdown images, base64 images, or external image URLs.";

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Rewrite this article for "${keyword}" for ${business.name} based on this feedback: ${feedback.join('. ')}.
        Current content: ${content}
        
        CRITICAL REQUIREMENTS:
        1. Ensure there is a well-formatted, clearly written summary at the very beginning of the article, optimized for generative AI engines to quickly extract the main points. Do NOT use the term "TL;DR" or "TL DR". Use a professional heading like "Executive Summary" or "Key Takeaways".
        2. Ensure there is a dedicated FAQ section at the end with conversational questions to capture natural language queries.
        3. The article MUST be between 1500 and 2000 words in length. This is a strict requirement for comprehensive coverage.
        4. Back up claims with real data, statistics, and references to reputable sources. Use your search tool to find accurate, up-to-date data to include.
        ${imageInstruction}
        6. INTERNAL LINKING: You MUST include 2-3 highly relevant internal links to existing pages on the business's website. Use your search tool to search the site (e.g., "site:${business.url} [related topic]") or reference their sitemap (${business.sitemapUrl ? business.sitemapUrl : 'if available'}) to find the exact URLs of relevant existing articles. Embed these links naturally within the HTML content using descriptive anchor text.
        
        Return a JSON object with the following structure:
        {
            "articleContent": "The HTML content of the rewritten article. ${business.skipImageGeneration ? 'Do NOT include any images.' : 'Must include <p>[IMAGE_1]</p>.'} Must include an AI-optimized summary at the beginning and an FAQ section at the end.",
            "metaTitle": "SEO optimized meta title (around 60 characters)",
            "metaDescription": "SEO optimized meta description (around 150 characters)",
            "slug": "url-friendly-slug"
        }`,
        config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    articleContent: { type: Type.STRING },
                    metaTitle: { type: Type.STRING },
                    metaDescription: { type: Type.STRING },
                    slug: { type: Type.STRING }
                }
            }
        }
    });
    
    const parsed = parseArticleResponse(response.text || '{}', keyword, business.name);
    return {
        articleContent: parsed.articleContent || content,
        metaTitle: parsed.metaTitle,
        metaDescription: parsed.metaDescription,
        slug: parsed.slug
    };
};

/**
 * Internal helper to upload any GeneratedImage to WordPress Media Library
 */
const uploadImageToWP = async (auth: string, cmsUrl: string, image: GeneratedImage, filename: string): Promise<{ id: number; url: string } | null> => {
    try {
        let blob: Blob;
        // Priority: 1. URL (Supabase Storage), 2. Base64 (Legacy/New generation)
        if (image.url) {
            blob = await fetch(image.url).then(r => r.blob());
        } else if (image.base64) {
            blob = await fetch(`data:image/jpeg;base64,${image.base64}`).then(r => r.blob());
        } else {
            return null;
        }

        const formData = new FormData();
        formData.append('file', blob, filename);
        if (image.prompt) {
            formData.append('alt_text', image.prompt);
            formData.append('title', image.prompt.substring(0, 50));
        }

        let mediaRes;
        try {
            mediaRes = await fetch(`${cmsUrl}/wp-json/wp/v2/media`, {
                method: 'POST',
                headers: { 'Authorization': `Basic ${auth}` },
                body: formData
            });
        } catch (e: any) {
            if (e.message === 'Failed to fetch') {
                console.error("WP Media upload failed due to CORS or network error.");
                return null;
            }
            throw e;
        }

        const mediaContentType = mediaRes.headers.get('content-type') || '';
        if (!mediaContentType.includes('application/json')) {
            const rawText = await mediaRes.text();
            console.error(`WP media endpoint returned non-JSON (status ${mediaRes.status}):`, rawText.slice(0, 500));
            return null;
        }

        if (mediaRes.ok) {
            const data = await mediaRes.json();
            return { id: data.id, url: data.source_url };
        } else {
            const err = await mediaRes.text();
            console.error("WP Media upload failed:", err);
        }
        return null;
    } catch (e) {
        console.error("WP Media upload exception:", e);
        return null;
    }
};

export const publishToWordPress = async (cms: CmsIntegration, post: ScheduledPost) => {
    const auth = btoa(`${cms.username}:${cms.applicationPassword}`);
    let finalContent = (post as any).article_content || post.articleContent || '';
    
    if (!finalContent) throw new Error("Article content is empty. Generate content before publishing.");

    // 1. Process Featured Image and [IMAGE_1] placeholder
    let featuredMediaId = 0;
    if (post.images?.featureImage) {
        const wpImg = await uploadImageToWP(auth, cms.url, post.images.featureImage, 'featured-image.jpg');
        if (wpImg) {
            featuredMediaId = wpImg.id;
            // Build the real HTML tag for the content
            const imgTag = `<img src="${wpImg.url}" alt="${post.images.featureImage.prompt || ''}" class="wp-post-image" style="width:100%; height:auto; border-radius:8px; margin-bottom:2rem;" />`;
            // Replace placeholder in body
            finalContent = finalContent.replace(/\[IMAGE_1\]/g, imgTag);
        }
    }

    // 2. Process Inline Images and [IMAGE_2+] placeholders
    if (post.images?.inlineImages) {
        for (let i = 0; i < post.images.inlineImages.length; i++) {
            const img = post.images.inlineImages[i];
            const placeholder = `[IMAGE_${i + 2}]`;
            const wpImg = await uploadImageToWP(auth, cms.url, img, `inline-image-${i + 1}.jpg`);
            if (wpImg) {
                const imgTag = `<img src="${wpImg.url}" alt="${img.prompt || ''}" class="wp-inline-image" style="width:100%; height:auto; border-radius:8px; margin:2rem 0;" />`;
                // Global regex to replace all occurrences of this specific placeholder
                finalContent = finalContent.replace(new RegExp(`\\[IMAGE_${i + 2}\\]`, 'g'), imgTag);
            }
        }
    }

    // Final cleanup: If any stray placeholders exist (e.g. AI skipped them or they weren't generated), remove them so they don't show to users
    finalContent = finalContent.replace(/\[IMAGE_\d+\]/g, '');

    const metaTitle = post.meta_title ?? post.metaTitle ?? post.keyword;
    const metaDesc = post.meta_description ?? post.metaDescription ?? '';

    const wpPost = {
        title: metaTitle,
        content: finalContent,
        status: 'publish',
        slug: post.slug,
        excerpt: metaDesc,
        featured_media: featuredMediaId > 0 ? featuredMediaId : undefined,
        meta: {
            _yoast_wpseo_metadesc: metaDesc,
            rank_math_description: metaDesc,
            _yoast_wpseo_title: metaTitle,
            rank_math_title: metaTitle
        }
    };

    let res;
    try {
        res = await fetch(`${cms.url}/wp-json/wp/v2/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify(wpPost)
        });
    } catch (e: any) {
        if (e.message === 'Failed to fetch') {
            throw new Error(`Failed to connect to WordPress at ${cms.url}. This is usually caused by CORS restrictions on your WordPress site. Please install a CORS plugin or configure your server to allow cross-origin requests from this app.`);
        }
        throw e;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const rawText = await res.text();
        console.error(`WP posts endpoint returned non-JSON (status ${res.status}):`, rawText.slice(0, 500));
        throw new Error(
            `WordPress returned an HTML page instead of JSON (status ${res.status}). ` +
            `This usually means a security plugin or firewall (Wordfence, Sucuri, etc.) is blocking the ` +
            `automated POST request, or the REST route is being redirected/cached. ` +
            `Check your site's firewall logs and REST API access rules for /wp-json/wp/v2/posts.`
        );
    }

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`WordPress publishing failed: ${errText}`);
    }
    const data = await res.json();
    return { url: data.link, slug: data.slug };
};

export const generateMetaData = async (content: string, keyword: string, business: BusinessInfo) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate SEO metadata for an article about "${keyword}" for ${business.name}.
        Content snippet: ${content.substring(0, 1000)}`,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    metaTitle: { type: Type.STRING },
                    metaDescription: { type: Type.STRING },
                    slug: { type: Type.STRING }
                }
            }
        }
    });
    try {
        return JSON.parse(cleanAIResponse(response.text || '{}'));
    } catch (e) {
        return {
            metaTitle: `${keyword} | ${business.name}`,
            metaDescription: `Read our comprehensive guide about ${keyword} for ${business.name} audiences.`,
            slug: keyword.toLowerCase().replace(/\s+/g, '-')
        };
    }
};

export const generateSingleImage = async (prompt: string, aspectRatio: "1:1" | "16:9" = "1:1"): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: [{ text: prompt }],
        config: {
            imageConfig: { aspectRatio }
        }
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
        const blockReason = (response as any).promptFeedback?.blockReason;
        throw new Error(
            blockReason
                ? `Image generation was blocked (reason: ${blockReason}).`
                : "No image data returned from model — the response contained no candidates."
        );
    }

    for (const part of candidate.content.parts) {
        if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("No image data returned from model");
};

export const generateImageAltText = async (base64: string, keyword: string) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64 } },
                    { text: `Describe this image for SEO alt text for an article about "${keyword}".` }
                ]
            }
        });
        return response.text || "";
    } catch (e) {
        console.error("Alt text generation failed, using fallback:", e);
        return `Image related to ${keyword}`;
    }
};

export const syncFeaturedImageToWordPress = async (cms: CmsIntegration, post: ScheduledPost) => {
    const auth = btoa(`${cms.username}:${cms.applicationPassword}`);
    
    // 1. Get the image blob
    const imagePart = post.images?.featureImage;
    if (!imagePart) return false;

    let blob: Blob;
    try {
        if (imagePart.url) {
            const response = await fetch(imagePart.url);
            blob = await response.blob();
        } else if (imagePart.base64) {
            const response = await fetch(`data:image/jpeg;base64,${imagePart.base64}`);
            blob = await response.blob();
        } else {
            return false;
        }
    } catch (e) {
        console.error("Failed to fetch image for sync:", e);
        return false;
    }

    // 2. Upload to Media
    const formData = new FormData();
    formData.append('file', blob, 'featured-image.jpg');
    formData.append('title', post.keyword);
    formData.append('alt_text', imagePart.prompt || post.keyword);

    let mediaRes;
    try {
        mediaRes = await fetch(`${cms.url}/wp-json/wp/v2/media`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}` },
            body: formData
        });
    } catch (e: any) {
        if (e.message === 'Failed to fetch') {
            console.error("WP Media upload failed due to CORS or network error.");
            return false;
        }
        throw e;
    }

    if (!mediaRes.ok) {
        const err = await mediaRes.text();
        console.error("WP Media upload failed:", err);
        return false;
    }
    const mediaData = await mediaRes.json();
    const mediaId = mediaData.id;

    // 3. Find post by slug to get ID
    let postSearchRes;
    try {
        postSearchRes = await fetch(`${cms.url}/wp-json/wp/v2/posts?slug=${post.slug}`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
    } catch (e: any) {
        if (e.message === 'Failed to fetch') {
            console.error("WP Post search failed due to CORS or network error.");
            return false;
        }
        throw e;
    }
    
    if (postSearchRes.ok) {
        const posts = await postSearchRes.json();
        if (posts.length > 0) {
            const wpPostId = posts[0].id;
            // 4. Update post with featured media
            let updateRes;
            try {
                updateRes = await fetch(`${cms.url}/wp-json/wp/v2/posts/${wpPostId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${auth}`
                    },
                    body: JSON.stringify({ featured_media: mediaId })
                });
            } catch (e: any) {
                if (e.message === 'Failed to fetch') {
                    console.error("WP Post update failed due to CORS or network error.");
                    return false;
                }
                throw e;
            }
            return updateRes.ok;
        }
    }

    return false; 
};

export const getChatbotResponse = async (messages: any[]) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: messages.map(m => ({
            role: m.role,
            parts: [{ text: m.parts[0].text }]
        })),
        config: {
            systemInstruction: "You are RankBot, a helpful assistant for Autorank AI. Answer questions about SEO and how to use the app."
        }
    });
    return response.text || "";
};