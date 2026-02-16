import React from "react";
import { Product } from "../types";
import { PRODUCTS } from "../constants";

interface LandingPageProps {
  onSelectProduct: (product: Product) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSelectProduct }) => {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <header className="mb-12">
        <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mb-4">
          Documentation Portal
        </h2>
        <p className="text-xl text-slate-500 max-w-2xl">
          Everything you need to build, scale, and integrate with our
          multi-product ecosystem. Written in Markdown, loved by developers.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {PRODUCTS.map((product) => (
          <div
            key={product.id}
            onClick={() => onSelectProduct(product)}
            className="group relative bg-white rounded-2xl shadow-sm border border-slate-200 p-8 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="text-8xl">{product.icon}</span>
            </div>

            <div className="relative">
              <div className="inline-flex items-center justify-center p-3 bg-indigo-50 text-indigo-600 rounded-xl mb-6">
                <span className="text-3xl">{product.icon}</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {product.name}
              </h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                {product.description}
              </p>

              <div className="flex items-center text-sm font-semibold text-indigo-600">
                View Documentation
                <svg
                  className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LandingPage;
