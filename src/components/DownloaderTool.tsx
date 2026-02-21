
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, MediaItem } from '../services/api';
import { TOOL_TABS } from '../constants';

interface Props {
  title: string;
  description: string;
}

const DownloaderTool: React.FC<Props> = ({ title, description }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [aiInfo, setAiInfo] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !url.includes('instagram.com')) {
      setError('Please enter a valid Instagram URL');
      return;
    }

    setError('');
    setLoading(true);
    setResult(null);
    setAiInfo('');

    try {
      const data = await api.getPreview(url);
      if (data.items && data.items.length > 0) {
        setResult(data as any);
        setAiInfo("Ready to download your content!");
      } else {
        setError("No media found on this link.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please check the link and try again.');
    } finally {
      setLoading(false);
    }
  };

  const executeDownload = async () => {
    if (!result) return;
    try {
      const extension = result.type === 'video' ? 'mp4' : 'jpg';
      const filename = `instagram_${result.shortcode || Date.now()}.${extension}`;
      await api.downloadMedia(url, 0, filename);
    } catch (err) {
      console.error("Download failed", err);
      alert("Download failed. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-16 md:py-24 text-center">
      <div className="mb-8">
        <h1 className="text-4xl md:text-7xl font-black mb-6 tracking-tight text-white">
          Instagram <span className="hero-text-gradient">{title}</span> Downloader
        </h1>
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
          {description}
        </p>
      </div>

      <div className="max-w-3xl mx-auto mb-16">
        {/* Tool Selector Tabs - FastDL Style */}
        <div className="flex flex-wrap justify-center gap-2 mb-6 p-1 bg-slate-900/50 rounded-2xl border border-slate-800 backdrop-blur">
          {TOOL_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${location.pathname === tab.path
                ? 'bg-slate-700 text-white shadow-lg'
                : 'text-slate-500 hover:text-white hover:bg-slate-800'
                }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleDownload} className="relative group">
          <div className="flex flex-col md:flex-row items-stretch gap-0 p-1.5 bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-3xl border border-slate-800 focus-within:border-pink-500/30 focus-within:ring-8 focus-within:ring-pink-500/5 transition-all">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste Instagram link here..."
              className="flex-grow px-8 py-6 bg-transparent text-white focus:outline-none text-xl placeholder-slate-500 font-medium"
            />
            <button
              type="submit"
              disabled={loading || !url}
              className="bg-white text-slate-950 px-12 py-5 md:m-1.5 rounded-2xl font-black text-xl hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed min-w-[200px]"
            >
              {loading ? (
                <svg className="animate-spin h-7 w-7 text-slate-900" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download
                </span>
              )}
            </button>
          </div>
          {error && <p className="text-red-400 mt-4 text-sm font-bold">{error}</p>}
        </form>
        <p className="mt-4 text-slate-500 text-xs font-medium">
          By using our service you accept our <a href="#" className="underline hover:text-slate-300">Terms of Service</a> and <a href="#" className="underline hover:text-slate-300">Privacy Policy</a>.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-12 text-center max-w-4xl mx-auto opacity-60">
        <div className="flex flex-col items-center">
          <svg className="w-8 h-8 mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Secure</span>
        </div>
        <div className="flex flex-col items-center">
          <svg className="w-8 h-8 mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">No Login</span>
        </div>
        <div className="flex flex-col items-center">
          <svg className="w-8 h-8 mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Fast</span>
        </div>
        <div className="flex flex-col items-center">
          <svg className="w-8 h-8 mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">HD Quality</span>
        </div>
      </div>

      {result && (
        <div className="mt-16 space-y-12">
          {/* Carousel / Multiple Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(result as any).items?.map((item: any, idx: number) => (
              <div key={idx} className="bg-slate-900/60 rounded-[2.5rem] shadow-4xl overflow-hidden border border-slate-800 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                <div className="p-3">
                  <img src={item.thumbnail} alt={`Preview ${idx + 1}`} className="w-full h-auto max-h-[400px] object-contain rounded-[2rem] shadow-xl" />
                </div>
                <div className="p-8 pt-2">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    <span className="text-green-500 font-bold text-[10px] uppercase tracking-widest">
                      {item.type === 'video' ? 'Video' : 'Image'} Ready
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      const extension = item.type === 'video' ? 'mp4' : 'jpg';
                      const filename = `instagram_${result.shortcode || Date.now()}_${idx + 1}.${extension}`;
                      await api.downloadMedia(url, idx, filename);
                    }}
                    className="w-full bg-white text-slate-950 py-4 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-95 shadow-xl shadow-white/5"
                  >
                    Download {item.type === 'video' ? 'Video' : 'Image'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Main ready state message for Single items (to keep original feel if only 1) */}
          {((result as any).items?.length === 1) && (
            <div className="bg-slate-700/20 py-6 px-8 rounded-3xl border border-dashed border-slate-700 text-slate-400 font-medium">
              HD Quality fetched successfully. Your file is ready for download.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DownloaderTool;
