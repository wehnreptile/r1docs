import React, { useState, useEffect, useRef } from "react";
import { Product, DocPage } from "../types";
import { PRODUCTS } from "../constants";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDoc: (product: Product, doc: DocPage) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectDoc,
}) => {
  const [query, setQuery] = useState("");
  const [filteredDocs, setFilteredDocs] = useState<
    { product: Product; doc: DocPage }[]
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else {
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setFilteredDocs([]);
      return;
    }
    const results: { product: Product; doc: DocPage }[] = [];
    PRODUCTS.forEach((p) => {
      p.docs.forEach((d) => {
        if (d.title.toLowerCase().includes(query.toLowerCase())) {
          results.push({ product: p, doc: d });
        }
      });
    });
    setFilteredDocs(results.slice(0, 5));
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 sm:px-0">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
        onClick={onClose}
      ></div>

      <div className="relative bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
        <div className="p-6 flex items-center border-b border-slate-100 glass-morphism sticky top-0 z-10">
          <svg
            className="w-6 h-6 text-indigo-500 mr-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M21 21l-4.35-4.35M16.65 11a5.65 5.65 0 11-11.3 0 5.65 5.65 0 0111.3 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 text-xl text-slate-700 bg-transparent border-none focus:outline-none placeholder-slate-400 font-medium"
            placeholder="Search documentation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto scrollbar-hide bg-slate-50/30">
          {filteredDocs.length > 0 && (
            <div className="p-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-4">
                Documentation Matches
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {filteredDocs.map(({ product, doc }) => (
                  <button
                    key={`${product.id}-${doc.id}`}
                    onClick={() => onSelectDoc(product, doc)}
                    className="w-full flex items-center p-4 rounded-2xl hover:bg-white hover:shadow-lg hover:-translate-y-0.5 text-left transition-all group border border-transparent hover:border-slate-100"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl mr-4 group-hover:bg-indigo-50 group-hover:scale-110 transition-all">
                      {product.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 text-lg leading-none mb-2 truncate">
                        {doc.title}
                      </h4>
                      <div className="flex items-center space-x-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <span>{product.name}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="text-indigo-500">{doc.category}</span>
                      </div>
                    </div>
                    <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg
                        className="w-6 h-6 text-indigo-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!query && (
            <div className="p-20 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-50 text-indigo-600 mb-6 shadow-inner">
                <svg
                  className="w-10 h-10"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-3">
                Search Documentation
              </h3>
              <p className="text-slate-500 max-w-sm mx-auto leading-relaxed font-medium">
                Try searching for "Rate Limits", "Auth Flow", "Order States", or
                "Webhooks".
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex space-x-6 text-[10px] text-slate-400 font-black uppercase tracking-widest">
            <span className="flex items-center">
              <kbd className="bg-white border border-slate-200 rounded-md px-2 py-1 mr-2 shadow-sm text-slate-600">
                Enter
              </kbd>{" "}
              to select
            </span>
            <span className="flex items-center">
              <kbd className="bg-white border border-slate-200 rounded-md px-2 py-1 mr-2 shadow-sm text-slate-600">
                Esc
              </kbd>{" "}
              to close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
