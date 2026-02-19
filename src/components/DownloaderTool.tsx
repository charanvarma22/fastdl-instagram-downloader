import React, { useState } from 'react';
import { api, PreviewResponse } from '../services/api';
import { Loader2, Download, AlertCircle, Video, Image as ImageIcon, Layers } from 'lucide-react';

interface DownloaderToolProps {
    title?: string;
    description?: string;
}

const DownloaderTool: React.FC<DownloaderToolProps> = ({
    title = "Instagram Downloader",
    description = "Download Video, Reels, Photo, Story, IGTV"
}) => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<PreviewResponse | null>(null);
    const [downloading, setDownloading] = useState(false);

    const handlePreview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setLoading(true);
        setError(null);
        setData(null);

        try {
            const result = await api.getPreview(url);
            setData(result);
        } catch (err: any) {
            console.error("Preview error:", err);
            setError(err.message || 'Unknown error occurred - please try another link');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (mediaUrl: string, index?: number) => {
        try {
            setDownloading(true);
            // api.downloadMedia handles trigger logic
            await api.downloadMedia(url, index);
        } catch (err: any) {
            console.error("Download error:", err);
            // Fallback to direct link if proxy fails?
            // window.open(mediaUrl, '_blank'); 
            setError(err.message || 'Download failed');
        } finally {
            setDownloading(false);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setUrl(text);
        } catch (err) {
            console.error('Failed to read clipboard', err);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-12">
            <div className="text-center mb-10">
                <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500">
                        {title}
                    </span>
                </h1>
                <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-medium">
                    {description}
                </p>
            </div>

            <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-sm">
                <form onSubmit={handlePreview} className="relative flex items-center">
                    <div className="absolute left-6 text-slate-500 hidden md:block">
                        <Layers className="w-6 h-6" />
                    </div>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Paste Instagram link here..."
                        className="w-full bg-transparent text-white placeholder-slate-500 pl-4 md:pl-16 pr-32 py-4 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-pink-500/50 text-lg font-medium border border-slate-700 focus:border-pink-500"
                    />
                    <div className="absolute right-2 flex gap-2">
                        <button
                            type="button"
                            onClick={handlePaste}
                            className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors hidden md:block"
                        >
                            PASTE
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !url}
                            className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start'}
                        </button>
                    </div>
                </form>
            </div>

            {error && (
                <div className="mt-8 bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl flex items-center justify-center gap-2 font-medium animate-in fade-in slide-in-from-top-4">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {data && data.items && (
                <div className="mt-12 animate-in fade-in slide-in-from-bottom-8">
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {data.items.map((item, idx) => (
                            <div key={idx} className="bg-slate-900/40 rounded-3xl overflow-hidden border border-slate-800 group hover:border-pink-500/30 transition-all flex flex-col">
                                <div className="relative aspect-[4/5] bg-slate-950">
                                    <img
                                        src={item.thumbnail}
                                        alt="Thumbnail"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1">
                                        {item.type === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                                        {item.type ? item.type.toUpperCase() : 'MEDIA'}
                                    </div>
                                </div>
                                <div className="p-6 mt-auto">
                                    <button
                                        onClick={() => handleDownload(item.mediaUrl, idx)}
                                        disabled={downloading}
                                        className="w-full bg-white text-slate-900 py-4 rounded-2xl font-black hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                        Download {item.type === 'video' ? 'Video' : 'Photo'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DownloaderTool;
