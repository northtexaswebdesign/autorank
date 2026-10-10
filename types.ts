
/** Look of a business, used for article cover images. Empty = read from the website, else Claude chooses. */
export interface BrandStyle {
  primary?: string;
  secondary?: string;
  background?: string;
  text?: string;
  headingFont?: string;
  bodyFont?: string;
  logoUrl?: string;
  source?: 'manual' | 'auto';
}

export interface BusinessInfo {
  id: string;
  url: string;
  name: string;
  description: string;
  audience: string;
  competitors: string[];
  autoSchedule: boolean;
  skipImageGeneration?: boolean; // New property to toggle image generation
  brandStyle?: BrandStyle | null; // cover image look (saved by hand or detected from the website)
  language?: string; // e.g., 'English', 'Vietnamese'
  sitemapUrl?: string;
  planData?: PersonalizedPlanData;
  competitorAnalysis?: CompetitorAnalysis | null;
  competitorAnalyzedAt?: string | null; // set by the server when an analysis starts; 1 per month per business
}

export enum KeywordOpportunity {
    High = "High",
    Medium = "Medium",
    Low = "Low"
}

export interface ContentCluster {
    pillar: string;
    clusters: string[];
}

export interface Keyword {
  id?: string;
  businessId?: string;
  keyword: string;
  opportunity: KeywordOpportunity;
  isQueued?: boolean;
  isStarred?: boolean;
  clusterId?: string;
}

export interface GeneratedImage {
    base64?: string;
    url?: string; // New field for Storage URL
    prompt: string;
}

export interface PostImages {
    featureImage?: GeneratedImage;
    inlineImages?: GeneratedImage[];
}

export interface SERPAnalysis {
    commonTopics: string[];
    uniqueAngle: string;
    contentGaps: string[];
}

export interface ContentBrief {
    outline: string[];
    keyQuestions: string[];
    persona: string;
    serpAnalysis?: SERPAnalysis;
}

export interface ScheduledPost {
  id: string;
  businessId?: string;
  keyword: string;
  publishDate: string; // ISO 8601 UTC timestamp string
  status: 'scheduled' | 'brief-generating' | 'generating-text' | 'generating-images' | 'draft' | 'analyzing' | 'rewriting' | 'published' | 'generating-meta';
  articleContent?: string;
  contentUrl?: string;
  content_url?: string;
  publishedUrl?: string;
  wpPostId?: number | null;
  publishAttempts?: number;
  published_url?: string;
  geoScore?: number;
  geo_score?: number;
  aiFeedback?: string[];
  progress?: number;
  metaTitle?: string;
  meta_title?: string;
  metaDescription?: string;
  meta_description?: string;
  slug?: string;
  images?: PostImages | null;
  impressions?: number;
  clicks?: number;
  avgPosition?: number;
  updatedAt?: string;
  contentBrief?: ContentBrief | null;
}

export interface CmsIntegration {
  id: string;
  businessId: string;
  platform: 'wordpress';
  url: string;
  username: string;
  applicationPassword?: string;
}

export type AppTab = 'dashboard' | 'planner' | 'intelligence' | 'calendar' | 'settings' | 'integrations' | 'past-articles' | 'log' | 'account-settings' | 'help' | 'admin';

export interface FAQItem {
  question: string;
  answer: string;
}

export interface PersonalizedPlanData {
    keywordOpportunitiesFound: number;
    monthlySearchVolume: number;
    totalMarketAdValue: number;
    websiteScreenshotUrl?: string;
}

export interface ActivityLog {
    id: string;
    createdAt: string;
    jobName: string;
    status: 'success' | 'error' | 'running';
    message: string;
}

export interface UserProfile {
  id: string;
  fullName?: string;
  planStatus: 'trial' | 'paid' | 'expired';
  planName?: 'Standard';
  trialArticlesCreated: number;
  updatedAt?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  trialEndDate?: string;
  creditsRemaining?: number;
  email?: string;
  role?: string;
}

export interface AppStateCache {
    selectedBusiness: BusinessInfo | null;
    suggestedKeywords: Keyword[];
    queuedKeywords: Keyword[];
    scheduledPosts: ScheduledPost[];
    cmsIntegration: CmsIntegration | null;
    activityLogs: ActivityLog[];
    userProfile: UserProfile | null;
}

export interface CompetitorAnalysisReport {
    url: string;
    strengths: string[];
    weaknesses: string[];
    contentStrategySummary: string;
}

export interface CompetitorAnalysis {
    analysis: CompetitorAnalysisReport[];
    strategicRecommendations: string[];
    analyzedAt: string;
}

export interface AppContextType {
    selectedBusiness: BusinessInfo | null;
    updateBusiness: (info: BusinessInfo) => Promise<void>;
    createBusiness: (info: Omit<BusinessInfo, 'id'>) => Promise<BusinessInfo | null>;
    cachePlanData: (data: PersonalizedPlanData) => Promise<void>;
    analyzeCompetitors: (onProgress: (progress: { value: number; text: string }) => void, business?: BusinessInfo) => Promise<void>;
    suggestedKeywords: Keyword[];
    queuedKeywords: Keyword[];
    addKeyword: (keyword: Omit<Keyword, 'id'>) => Promise<void>;
    addKeywordToQueue: (keyword: Keyword) => Promise<void>;
    addKeywordsToQueue: (keywords: Omit<Keyword, 'id'>[]) => Promise<void>;
    removeKeywordFromQueue: (keyword: Keyword) => Promise<void>;
    deleteKeyword: (keywordId: string) => Promise<void>;
    deleteKeywords: (keywordIds: string[]) => Promise<void>;
    toggleKeywordStar: (keyword: Keyword) => Promise<void>;
    schedulePostsFromContentPlan: () => Promise<void>;
    schedulePostsFromAllKeywords: () => Promise<void>;
    generateAndStoreKeywords: (language?: string) => Promise<void>;
    suggestContentCluster: (targetKeyword: string) => Promise<ContentCluster | null>;
    generateArticleFromKeyword: (keyword: Keyword) => Promise<void>;
    scheduledPosts: ScheduledPost[];
    addScheduledPosts: (posts: Omit<ScheduledPost, 'id'>[]) => Promise<ScheduledPost[] | null>;
    updateScheduledPost: (postId: string, updates: Partial<ScheduledPost>) => Promise<ScheduledPost | null>;
    deleteScheduledPost: (postId: string) => Promise<void>;
    unschedulePost: (postId: string) => Promise<void>;
    cmsIntegration: CmsIntegration | null;
    updateCmsIntegration: (integration: Omit<CmsIntegration, 'id' | 'businessId' | 'platform'>) => Promise<void>;
    loading: boolean;
    editingPost: ScheduledPost | null;
    setEditingPost: (post: ScheduledPost | null) => void;
    activeTab: AppTab;
    setActiveTab: (tab: AppTab) => void;
    activityLogs: ActivityLog[];
    logActivity: (message: string, status: 'success' | 'error' | 'running') => Promise<void>;
    isLoadingEditingPost: boolean;
    editingPostId: string | null;
    userProfile: UserProfile | null;
    updateUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
    isLocked: boolean;
    isTrialExpired: boolean;
    isSubscriptionExpired: boolean;
}
