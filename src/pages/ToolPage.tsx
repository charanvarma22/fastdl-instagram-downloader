
import React from 'react';
import DownloaderTool from '../components/DownloaderTool';
import FAQ from '../components/FAQ';
import Features from '../components/Features';
import { ToolType } from '../types';
import { TOOL_SEO_CONTENT } from '../constants';

interface Props {
  type: ToolType;
}

const ToolPage: React.FC<Props> = ({ type }) => {
  const content = {
    reels: {
      title: "Instagram Reels",
      desc: "Download high-quality Instagram Reels (HD) instantly without watermarks. The ultimate free tool for saving viral Reels to your mobile gallery or PC in 2026."
    },
    video: {
      title: "Instagram Video",
      desc: "Save any Instagram video to your phone or computer in original MP4 format. High-speed, secure, and completely free online video saver."
    },
    photo: {
      title: "Instagram Photo",
      desc: "Download high-resolution Instagram photos, profile pictures, and carousels. Save the original JPEG quality with just one click for free."
    },
    stories: {
      title: "Instagram Story",
      desc: "Download Instagram Stories and Highlights anonymously in HD. Save expiring content before it disappears forever from the platform in 2026."
    },
    igtv: {
      title: "Instagram IGTV",
      desc: "The professional tool for downloading long-form IGTV videos. Save high-definition content for offline study, travel, or entertainment."
    },
    all: {
      title: "Instagram",
      desc: "The most comprehensive online tool to download any media from Instagram for free. Save Reels, Videos, Photos, and Stories today."
    }
  };

  const selected = content[type] || content.all;
  const seo = TOOL_SEO_CONTENT[type as keyof typeof TOOL_SEO_CONTENT] || TOOL_SEO_CONTENT.reels;

  return (
    <div className="bg-slate-950 min-h-screen">
      <DownloaderTool title={selected.title} description={selected.desc} />
      
      {/* Specific SEO Content Block */}
      <section className="bg-slate-900/20 py-20 border-y border-slate-900">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-6 underline decoration-pink-500 decoration-4 underline-offset-8">
              {seo.title}
            </h2>
            <h3 className="text-xl font-bold text-slate-300 mb-8">{seo.h2}</h3>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 text-slate-400 font-medium leading-relaxed">
            <p className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800">
              {seo.p1}
            </p>
            <p className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800">
              {seo.p2}
            </p>
          </div>
        </div>
      </section>

      <Features />
      
      {/* Technical FAQ / Guide section for ranking */}
      <section className="py-24 bg-slate-950">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-black text-white mb-10 text-center">Technical Specifications for {selected.title} Downloads</h2>
          <div className="space-y-4">
            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex justify-between items-center">
              <span className="font-bold text-slate-300">Supported Format</span>
              <span className="text-pink-500 font-black">{type === 'photo' ? 'JPEG / PNG' : 'MP4 / MOV'}</span>
            </div>
            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex justify-between items-center">
              <span className="font-bold text-slate-300">Max Resolution</span>
              <span className="text-pink-500 font-black">1080p Full HD / 4K</span>
            </div>
            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex justify-between items-center">
              <span className="font-bold text-slate-300">Download Speed</span>
              <span className="text-pink-500 font-black">Unlimited (CDN Powered)</span>
            </div>
            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex justify-between items-center">
              <span className="font-bold text-slate-300">Anonymity Level</span>
              <span className="text-pink-500 font-black">100% Secure & Private</span>
            </div>
          </div>
        </div>
      </section>

      {/* How to steps specifically for this tool */}
      <section className="py-20 bg-slate-900/10">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-black text-white mb-16">How to Save {selected.title} to Your Device</h2>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { num: "01", label: "Copy the Link", txt: "Find the content you want to save. Tap 'Share' and then 'Copy Link' to get the URL." },
              { num: "02", label: "Enter Link", txt: "Paste the URL into the search box above. Our tool will instantly analyze the source." },
              { num: "03", label: "Download", txt: "Click the download button and the file will be saved directly to your local storage." }
            ].map((step, i) => (
              <div key={i} className="group p-10 bg-slate-900/40 rounded-[3rem] border border-slate-800 hover:border-pink-500/30 transition-all">
                <div className="text-5xl font-black text-slate-800 mb-6 group-hover:text-pink-500/20 transition-colors">{step.num}</div>
                <h3 className="text-2xl font-bold text-white mb-4">{step.label}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.txt}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="bg-slate-950">
        <FAQ />
      </div>
    </div>
  );
};

export default ToolPage;
