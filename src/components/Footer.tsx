
import React from 'react';
import { Link } from 'react-router-dom';
import { NAV_LINKS } from '../constants';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 pt-16 pb-8 border-t border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-6 text-white">
              <div className="w-8 h-8 rounded-lg insta-gradient flex items-center justify-center font-bold text-xl">I</div>
              <span className="text-2xl font-extrabold tracking-tight">InstamInsta</span>
            </Link>
            <p className="text-sm leading-relaxed max-w-xs">
              The fastest and safest way to download Instagram content. Free, anonymous, and high quality.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Tools</h4>
            <ul className="space-y-4 text-sm">
              {NAV_LINKS.filter(l => l.type !== 'all').map(link => (
                <li key={link.path}>
                  <Link to={link.path} className="hover:text-pink-500 transition-colors">{link.name} Downloader</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Legal</h4>
            <ul className="space-y-4 text-sm">
              <li><Link to="/privacy" className="hover:text-pink-500 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-pink-500 transition-colors">Terms of Service</Link></li>
              <li><Link to="/contact" className="hover:text-pink-500 transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Newsletter</h4>
            <p className="text-sm mb-4">Get the latest Instagram marketing tips directly in your inbox.</p>
            <div className="flex gap-2">
              <input type="email" placeholder="Email address" className="bg-slate-800 border-none rounded-lg px-4 py-2 w-full focus:ring-2 focus:ring-pink-500 text-slate-200" />
              <button className="bg-pink-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-pink-700 transition-colors">Join</button>
            </div>
          </div>
        </div>
        
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center text-xs">
          <p>© 2026 InstamInsta.com - All rights reserved.</p>
          <p className="mt-4 md:mt-0 italic">Not affiliated with Instagram or Meta Platforms, Inc.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
