
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 glass border-b border-white/5 py-4 px-6 mb-8">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Gemini Voice Studio</h1>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">AI Text-to-Speech Engine</p>
          </div>
        </div>
        <div className="hidden md:flex items-center space-x-6">
          <span className="text-sm font-medium text-slate-400">Hỗ trợ 20.000 ký tự</span>
          <a href="https://ai.google.dev" target="_blank" rel="noreferrer" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">Documentation</a>
        </div>
      </div>
    </header>
  );
};

export default Header;
