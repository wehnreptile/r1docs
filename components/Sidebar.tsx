
import React from 'react';
import { Product, DocPage } from '../types';

interface SidebarProps {
  product: Product;
  activeDocId: string;
  onSelectDoc: (doc: DocPage) => void;
  onGoHome: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ product, activeDocId, onSelectDoc, onGoHome }) => {
  const categories = Array.from(new Set(product.docs.map(d => d.category)));

  return (
    <aside className="w-64 border-r border-slate-200 bg-white h-full flex flex-col shrink-0">
      <div className="p-6 border-b border-slate-100">
        <button 
          onClick={onGoHome}
          className="text-xs text-slate-400 hover:text-indigo-600 flex items-center mb-4 transition-colors"
        >
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Portal
        </button>
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{product.icon}</span>
          <h2 className="font-bold text-slate-800 leading-tight">{product.name}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-hide">
        {categories.map(category => (
          <div key={category}>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3">
              {category}
            </h3>
            <ul className="space-y-1">
              {product.docs
                .filter(d => d.category === category)
                .map(doc => (
                  <li key={doc.id}>
                    <button
                      onClick={() => onSelectDoc(doc)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                        activeDocId === doc.id
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {doc.title}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50">
        <div className="flex items-center p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold mr-3">
            DS
          </div>
          <div className="text-xs">
            <p className="font-semibold text-slate-700">Dev Support</p>
            <p className="text-slate-400">On Slack #dev-docs</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
