
import React from 'react';

const Features: React.FC = () => {
  const features = [
    { title: "Lossless Quality", desc: "Original resolution fetching without any server-side compression.", icon: "💎" },
    { title: "Pure Content", desc: "No watermarks, no logos, just your media exactly as posted.", icon: "🚿" },
    { title: "Turbo Engine", desc: "Node-accelerated servers ensure instant processing.", icon: "⚡" },
    { title: "Military Grade", desc: "Full SSL encryption and automatic data purging every hour.", icon: "🔒" },
  ];

  return (
    <section className="py-24 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-20">
          <h2 className="text-[10px] font-black mb-4 text-pink-500 uppercase tracking-[0.5em]">The Standard</h2>
          <h3 className="text-4xl font-black text-white">Engineered for Performance</h3>
        </div>
        <div className="grid md:grid-cols-4 gap-8">
          {features.map((f, i) => (
            <div key={i} className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 hover:border-pink-500/50 transition-all hover:-translate-y-2 shadow-2xl">
              <div className="text-5xl mb-8">{f.icon}</div>
              <h3 className="text-xl font-bold mb-4 text-white">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
