
import React, { useState, useEffect } from 'react';
import { AppTab, BusinessInfo } from '../types.ts';
import { useApp } from '../context/AppContext.tsx';
import { InputField } from './common/InputField.tsx';
import { TextareaField } from './common/TextareaField.tsx';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { AnalysisProgressModal } from './AnalysisProgressModal.tsx';
import { supabase } from '../services/supabaseClient.ts';
import { uploadImageFromBase64 } from '../utils/imageStorage.ts';
import { LinkIcon } from './icons/LinkIcon.tsx';

interface BusinessInfoTabProps {
  setActiveTab: (tab: AppTab) => void;
}

export const BusinessInfoTab: React.FC<BusinessInfoTabProps> = ({ setActiveTab }) => {
  const { selectedBusiness, updateBusiness, analyzeCompetitors } = useApp();

  const [formData, setFormData] = useState<Omit<BusinessInfo, 'id'>>({
    url: '',
    name: '',
    description: '',
    audience: '',
    competitors: ['', '', ''],
    autoSchedule: false,
    skipImageGeneration: false,
    language: 'English',
    sitemapUrl: '',
  });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ value: 0, text: '' });
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);

  // Migration State
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'scanning' | 'migrating' | 'done'>('idle');
  const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (selectedBusiness) {
      const competitorUrls = Array.from({ length: 3 }, (_, i) => selectedBusiness.competitors?.[i] || '');
      setFormData({
          ...selectedBusiness,
          competitors: competitorUrls,
          language: selectedBusiness.language || 'English',
          sitemapUrl: selectedBusiness.sitemapUrl || '',
          skipImageGeneration: selectedBusiness.skipImageGeneration || false,
      });
    }
  }, [selectedBusiness]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCompetitorChange = (index: number, value: string) => {
    const newCompetitors = [...formData.competitors];
    newCompetitors[index] = value;
    setFormData(prev => ({ ...prev, competitors: newCompetitors }));
  };

  const brand = formData.brandStyle || {};
  const setBrand = (key: string, value: string) =>
    setFormData(prev => ({ ...prev, brandStyle: { ...(prev.brandStyle || {}), [key]: value, source: 'manual' } }));
  const clearBrand = () => setFormData(prev => ({ ...prev, brandStyle: null }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusiness) return;
    const updatedBusiness = {
        ...selectedBusiness,
        ...formData,
        competitors: formData.competitors.filter(c => c.trim() !== ''),
    };
    updateBusiness(updatedBusiness);
    alert('Business information saved successfully!');
  };

  const handleAnalyze = async () => {
    if (!selectedBusiness) return;
    
    setIsAnalyzing(true);
    
    // 1. First, save current state to ensure the service sees all competitors typed by user
    const updatedBusiness = {
        ...selectedBusiness,
        ...formData,
        competitors: formData.competitors.filter(c => c.trim() !== ''),
    };
    await updateBusiness(updatedBusiness);

    setIsAnalysisModalOpen(true);
    setIsAnalysisComplete(false);
    setAnalysisProgress({ value: 0, text: 'Initializing...' });

    try {
        // 2. Now run analysis with the updated business object
        await analyzeCompetitors((progress) => {
            setAnalysisProgress(progress);
        });
        setIsAnalysisComplete(true);
    } catch(e) {
        alert(`Analysis failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        setIsAnalysisModalOpen(false); 
    } finally {
        setIsAnalyzing(false);
    }
  }
  
  const handleGoToReport = () => {
    setIsAnalysisModalOpen(false);
    setActiveTab('intelligence');
  }

  const handleMigrateImages = async () => {
      if (!selectedBusiness) return;
      
      setMigrationStatus('scanning');
      
      try {
          const { data: posts, error } = await supabase
              .from('posts')
              .select('id, keyword, images')
              .eq('business_id', selectedBusiness.id);

          if (error) throw error;
          
          if (!posts || posts.length === 0) {
              alert("No posts found to migrate.");
              setMigrationStatus('idle');
              return;
          }

          const candidates = posts.filter(p => {
              const img = p.images;
              if (!img) return false;
              
              const checkNode = (node: any) => {
                  if (!node) return false;
                  const hasData = node.base64 && node.base64.length > 200;
                  const hasUrl = !!node.url;
                  if (hasData && !hasUrl) return true;
                  if (hasData && hasUrl) return true;
                  return false;
              };

              const feature = img.feature_image || img.featureImage;
              const inline = img.inline_images || img.inlineImages || [];
              return checkNode(feature) || inline.some(checkNode);
          });

          if (candidates.length === 0) {
              alert("Great news! All your articles are already optimized. No heavy base64 data found.");
              setMigrationStatus('done');
              return;
          }

          setMigrationStatus('migrating');
          setMigrationProgress({ current: 0, total: candidates.length });

          for (let i = 0; i < candidates.length; i++) {
              const post = candidates[i];
              const images = post.images;
              let changed = false;

              const processNode = async (node: any) => {
                  if (!node) return false;
                  if (node.url && node.base64) {
                      delete node.base64;
                      return true;
                  }
                  if (node.base64 && !node.url) {
                      const url = await uploadImageFromBase64(node.base64, 'migrated');
                      if (url) {
                          node.url = url;
                          delete node.base64; 
                          return true;
                      }
                  }
                  return false;
              };

              if (await processNode(images.feature_image)) changed = true;
              if (await processNode(images.featureImage)) changed = true;

              const inlineArr = images.inline_images || images.inlineImages;
              if (Array.isArray(inlineArr)) {
                  for (const imgNode of inlineArr) {
                      if (await processNode(imgNode)) changed = true;
                  }
              }

              if (changed) {
                  await supabase.from('posts').update({ images: images }).eq('id', post.id);
              }

              setMigrationProgress({ current: i + 1, total: candidates.length });
          }

          setMigrationStatus('done');
          alert(`Success! ${candidates.length} articles have been optimized (migrated or cleaned).`);

      } catch (err) {
          console.error("Migration/Cleanup failed:", err);
          alert("Process encountered an error. Check console for details.");
          setMigrationStatus('idle');
      }
  };

  if (!selectedBusiness) {
      return <div>Loading business info...</div>
  }

  return (
    <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-8">Business Information & Settings</h1>
        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
            <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm p-8 space-y-6">
                <h2 className="text-xl font-semibold text-slate-900">Your Business Profile</h2>
                <InputField label="Business URL" name="url" value={formData.url} onChange={handleChange} placeholder="https://example.com" />
                <InputField label="Business Name" name="name" value={formData.name} onChange={handleChange} placeholder="Acme Inc." />
                <TextareaField label="Short Business Description" name="description" value={formData.description} onChange={handleChange} placeholder="What you do, for whom." />
                <InputField label="Target Audience" name="audience" value={formData.audience} onChange={handleChange} placeholder="e.g., Startup founders" />
                <InputField 
                    label="Sitemap URL (Optional)" 
                    name="sitemapUrl" 
                    value={formData.sitemapUrl || ''} 
                    onChange={handleChange} 
                    placeholder="https://example.com/sitemap.xml"
                    type="url"
                    description="Provide a link to your XML sitemap. This may be used in the future for advanced analytics and crawling features."
                />
                <div>
                    <label htmlFor="language" className="block text-sm font-medium text-slate-700 mb-1.5">Main Output Language</label>
                    <select
                        id="language"
                        name="language"
                        value={formData.language}
                        onChange={handleChange}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                    >
                        <option value="English">English</option>
                        <option value="Vietnamese">Vietnamese</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">The primary language for all AI-generated content.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Main Competitors (URLs)</label>
                    <div className="space-y-2">
                        {formData.competitors.map((competitor, index) => (
                            <input
                                key={index}
                                type="url"
                                value={competitor}
                                onChange={(e) => handleCompetitorChange(index, e.target.value)}
                                placeholder={`https://competitor${index + 1}.com`}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                            />
                        ))}
                    </div>
                     <button 
                        type="button"
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !formData.competitors.some(c => c)}
                        className="mt-4 bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-800 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center transition-all shadow-sm"
                    >
                       <SparklesIcon className={`w-5 h-5 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
                       {isAnalyzing ? 'Analyzing...' : 'Analyze Competitors with AI'}
                    </button>
                </div>
            </div>

             {selectedBusiness.competitorAnalysis && (
                <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm p-8">
                    <h2 className="text-xl font-semibold text-slate-900 mb-4">Existing Analysis</h2>
                    <p className="text-slate-600 mb-4">An AI-powered competitive analysis has already been generated. You can view the full report in the "AI Intelligence" tab, or run a new analysis to overwrite it.</p>
                     <button 
                        type="button"
                        onClick={() => setActiveTab('intelligence')}
                        className="bg-slate-800 text-white px-4 py-2 rounded-lg font-semibold hover:bg-slate-900 flex items-center transition-colors shadow-sm"
                    >
                       View Report
                    </button>
                </div>
            )}

            <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm p-8 space-y-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Automation & Content Settings</h2>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-slate-800">Master Auto-Schedule</p>
                        <p className="text-sm text-slate-500">Enables the backend automation to run daily, processing any posts scheduled for that day.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => updateBusiness({ ...selectedBusiness, autoSchedule: !formData.autoSchedule})}
                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
                            formData.autoSchedule ? 'bg-orange-500' : 'bg-gray-200'
                        }`}
                    >
                        <span
                            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                                formData.autoSchedule ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
                
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="font-medium text-slate-800">Skip Image Generation</p>
                        <p className="text-sm text-slate-500">When enabled, AI will only generate text content and skip creating unique images.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => updateBusiness({ ...selectedBusiness, skipImageGeneration: !formData.skipImageGeneration})}
                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
                            formData.skipImageGeneration ? 'bg-orange-500' : 'bg-gray-200'
                        }`}
                    >
                        <span
                            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                                formData.skipImageGeneration ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm p-8 space-y-5">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900">Brand Style for Cover Images</h2>
                    <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                        Every article gets a cover image in your brand style. Leave this empty and we read the colors and logo from your website the first time an image is made. If that finds nothing, the AI picks a look that fits the article.
                    </p>
                    {brand.source === 'auto' && (
                        <p className="text-xs text-emerald-700 mt-2">These values were read from your website. Edit any of them to override.</p>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {([['primary', 'Main color', '#E59173'], ['secondary', 'Soft accent color', '#EFDED9'], ['background', 'Background color', '#F5F5F5'], ['text', 'Headline color', '#1A1A1A']] as const).map(([key, label, ph]) => (
                        <div key={key}>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    aria-label={`${label} picker`}
                                    value={/^#[0-9a-f]{6}$/i.test((brand as any)[key] || '') ? (brand as any)[key] : ph}
                                    onChange={e => setBrand(key, e.target.value)}
                                    className="h-10 w-12 rounded border border-slate-300 bg-white p-1"
                                />
                                <input
                                    type="text"
                                    value={(brand as any)[key] || ''}
                                    onChange={e => setBrand(key, e.target.value)}
                                    placeholder={ph}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                                />
                            </div>
                        </div>
                    ))}
                    {([['headingFont', 'Heading font'], ['bodyFont', 'Body font']] as const).map(([key, label]) => (
                        <div key={key}>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                            <select
                                value={(brand as any)[key] || ''}
                                onChange={e => setBrand(key, e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                            >
                                <option value="">Auto</option>
                                {['Inter', 'Montserrat', 'DM Sans', 'Poppins', 'Space Grotesk', 'Cormorant Garamond', 'Playfair Display', 'Lora'].map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
                <InputField
                    label="Logo image URL"
                    name="brandLogoUrl"
                    value={brand.logoUrl || ''}
                    onChange={e => setBrand('logoUrl', e.target.value)}
                    placeholder="https://yoursite.com/logo.png"
                    description="PNG, JPG, WebP or SVG. Shown at the bottom of each cover."
                />
                {formData.brandStyle && (
                    <button type="button" onClick={clearBrand} className="text-sm text-slate-600 underline hover:text-slate-900">
                        Clear brand style (read it from my website again)
                    </button>
                )}
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm p-8">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 flex items-center">
                            <LinkIcon className="w-5 h-5 mr-2 text-slate-500" />
                            Storage Optimization
                        </h2>
                        <p className="text-slate-600 mt-2 text-sm max-w-2xl">
                            If you have articles with images stored directly in the database (causing slow loads), this tool moves them to your Storage Bucket. It also cleans up redundant data to reduce database size.
                        </p>
                    </div>
                </div>
                
                <div className="mt-6">
                    {migrationStatus === 'idle' || migrationStatus === 'done' ? (
                        <button
                            type="button"
                            onClick={handleMigrateImages}
                            className="bg-slate-100 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg font-semibold hover:bg-slate-200 transition-colors shadow-sm text-sm flex items-center"
                        >
                            {migrationStatus === 'done' ? 'Scan Again' : 'Migrate & Cleanup Images'}
                        </button>
                    ) : (
                        <div className="w-full max-w-md">
                            <div className="flex justify-between text-xs text-slate-600 mb-1">
                                <span>{migrationStatus === 'scanning' ? 'Scanning database...' : `Optimizing...`}</span>
                                <span>{migrationProgress.current} / {migrationProgress.total}</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                                <div 
                                    className="bg-orange-500 h-2 rounded-full transition-all duration-300" 
                                    style={{ width: `${migrationProgress.total > 0 ? (migrationProgress.current / migrationProgress.total) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex justify-end">
                <button type="submit" className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-amber-500 hover:to-orange-600 transition-all shadow-sm hover:shadow-md">
                    Save Settings
                </button>
            </div>
        </form>

        <AnalysisProgressModal
            isOpen={isAnalysisModalOpen}
            onClose={() => setIsAnalysisModalOpen(false)}
            progress={analysisProgress}
            isComplete={isAnalysisComplete}
            onGoToReport={handleGoToReport}
        />
    </div>
  );
};
