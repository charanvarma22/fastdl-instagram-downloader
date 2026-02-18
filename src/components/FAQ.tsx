
import React, { useState } from 'react';
import { FAQS } from '../constants';

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-32 bg-slate-950">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-[10px] font-black mb-4 text-orange-500 uppercase tracking-[0.5em]">Expert Insights</h2>
          <h3 className="text-4xl font-black text-white">Questions & Answers</h3>
        </div>
        <div className="space-y-6">
          {FAQS.map((faq, index) => (
            <div key={index} className={`rounded-[2rem] border transition-all duration-300 ${openIndex === index ? 'bg-slate-900 border-slate-700 shadow-2xl' : 'bg-transparent border-slate-800 hover:border-slate-700'}`}>
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex justify-between items-center p-8 text-left focus:outline-none group"
              >
                <span className={`text-lg font-bold transition-colors ${openIndex === index ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  {faq.question}
                </span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${openIndex === index ? 'bg-pink-500 text-white rotate-180' : 'bg-slate-800 text-slate-500'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              {openIndex === index && (
                <div className="px-8 pb-8 text-slate-400 leading-relaxed font-medium text-base animate-in slide-in-from-top-2 duration-300">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
