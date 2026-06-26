import React from "react";
import { Product, DocPage } from "../types";
import ProductIcon from "./ProductIcon";

interface SidebarProps {
  product: Product;
  activeDocId: string;
  onSelectDoc: (doc: DocPage) => void;
  onGoHome: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  product,
  activeDocId,
  onSelectDoc,
  onGoHome,
  isOpen = false,
  onClose,
}) => {
  const categories = Array.from(new Set(product.docs.map((d) => d.category)));

  return (
    <>
      {/* Mobile backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-900/40 md:hidden transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 transition-transform duration-200 ease-out md:static md:z-auto md:h-full md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onGoHome}
              className="text-xs text-slate-400 hover:text-indigo-600 flex items-center transition-colors"
            >
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Portal
            </button>
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="md:hidden -mr-1 p-1 rounded text-slate-400 hover:bg-slate-100"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
            <ProductIcon id={product.id} className="h-[18px] w-[18px]" />
          </div>
          <h2 className="font-bold text-slate-800 leading-tight">
            {product.name}
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-hide">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3">
              {category}
            </h3>
            <ul className="space-y-1">
              {product.docs
                .filter((d) => d.category === category)
                .map((doc) => (
                  <li key={doc.id}>
                    <button
                      onClick={() => onSelectDoc(doc)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                        activeDocId === doc.id
                          ? "bg-indigo-50 text-indigo-700 font-medium"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
      </aside>
    </>
  );
};

export default Sidebar;
