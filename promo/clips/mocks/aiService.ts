// Stand-in for services/aiService.ts in the clip harness: every call waits until the clip timeline resolves it.
const w = window as any;
w.__pending = w.__pending || {};
const wait = (name: string) => new Promise<any>(res => { w.__pending[name] = res; });
export const cleanAIResponse = (t: string) => t;
export const generateKeywords = () => wait('generateKeywords');
export const suggestContentCluster = () => wait('suggestContentCluster');
export const analyzeCompetitors = () => wait('analyzeCompetitors');
export const generateFullArticle = () => wait('generateFullArticle');
export const generateArticleImages = () => wait('generateArticleImages');
export const analyzeArticleForGEO = () => wait('analyzeArticleForGEO');
export const rewriteArticle = () => wait('rewriteArticle');
export const publishToWordPress = () => wait('publishToWordPress');
export const generateMetaData = () => wait('generateMetaData');
export const generateSingleImage = () => wait('generateSingleImage');
export const generateImageAltText = () => wait('generateImageAltText');
export const syncFeaturedImageToWordPress = () => wait('syncFeaturedImageToWordPress');
export const getChatbotResponse = () => wait('getChatbotResponse');
