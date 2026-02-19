
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NAV_LINKS } from '../constants';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl insta-gradient flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-orange-500/20">I</div>
              <span className="text-2xl font-black tracking-tighter text-white">InstamInsta</span>
            </Link>
          </div>
          
          <div className="hidden lg:flex flex-grow justify-center space-x-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-bold transition-all duration-200 hover:scale-105 ${
                  location.pathname === link.path 
                    ? 'text-pink-500' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {link.name.replace('Downloader', '').replace('Saver', '').trim()}
              </Link>
            ))}
          </div>

          <div className="hidden lg:block">
            <button className="bg-slate-800 text-white px-6 py-2.5 rounded-full text-sm font-black hover:bg-slate-700 transition-all border border-slate-700">
              Try Pro
            </button>
          </div>

          <div className="lg:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-400 hover:text-white focus:outline-none"
            >
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 py-6 space-y-3 shadow-2xl">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setIsOpen(false)}
              className="block px-4 py-3 rounded-xl text-lg font-bold text-slate-300 hover:bg-slate-800 hover:text-pink-500 transition-all"
            >
              {link.name}
            </Link>
          ))}
          <button className="w-full mt-4 bg-pink-600 text-white py-4 rounded-xl font-bold">Try Pro</button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
