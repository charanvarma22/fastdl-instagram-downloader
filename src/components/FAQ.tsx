
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "Is InstamInsta completely free?",
      answer: "Yes, our tool is 100% free to use. There are no hidden fees, subscriptions, or limits on the number of downloads you can perform daily."
    },
    {
      question: "Is it safe to use this downloader?",
      answer: "Absolutely. We do not require any login credentials or personal information. Your downloads are processed securely and anonymously."
    },
    {
      question: "can I download content from private accounts?",
      answer: "We respect user privacy. You can only download content from public accounts. Private accounts require permission which our tool does not bypass."
    },
    {
      question: "What formats are supported?",
      answer: "We support high-quality MP4 for videos and Reels, and JPEG for photos. We always serve the highest resolution available from Instagram."
    },
    {
      question: "Does it work on mobile?",
      answer: "Yes! InstamInsta is fully responsive and works perfectly on iPhone, Android, tablets, and desktop computers via any modern web browser."
    }
  ];

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-24 bg-slate-950">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-3 bg-pink-500/10 rounded-2xl mb-6">
            <HelpCircle className="w-8 h-8 text-pink-500" />
          </div>
          <h2 className="text-4xl font-black text-white mb-4">Frequently Asked Questions</h2>
          <p className="text-slate-400">Everything you need to know about the service.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden transition-all duration-300 ${openIndex === index ? 'border-pink-500/30 bg-slate-900/60' : 'hover:border-slate-700'}`}
            >
              <button
                className="w-full text-left px-8 py-6 flex items-center justify-between gap-4"
                onClick={() => toggle(index)}
              >
                <span className="text-lg font-bold text-white">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-pink-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-500 flex-shrink-0" />
                )}
              </button>

              <div
                className={`px-8 overflow-hidden transition-all duration-300 ease-in-out ${openIndex === index ? 'max-h-96 pb-8 opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <p className="text-slate-400 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
