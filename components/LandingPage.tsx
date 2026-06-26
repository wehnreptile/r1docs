import React from "react";
import { Product, DocPage } from "../types";
import { PRODUCTS } from "../constants";
import ProductIcon from "./ProductIcon";

interface LandingPageProps {
  onSelectProduct: (product: Product) => void;
  onSelectDoc: (product: Product, doc: DocPage) => void;
  onOpenSearch: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({
  onSelectProduct,
  onSelectDoc,
  onOpenSearch,
}) => {
  const totalDocs = PRODUCTS.reduce((n, p) => n + p.docs.length, 0);

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-100">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_top,theme(colors.indigo.50),transparent)]"
        />
        <div className="mx-auto max-w-5xl px-6 py-10 sm:px-8 sm:py-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
            Reptile Platform
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
            Documentation for the
            <span className="text-slate-400"> entire ecosystem</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500">
            Architecture, API references, and engineering guides from the
            consumer app to the delivery backend. Everything in one place.
          </p>

          <button
            onClick={onOpenSearch}
            className="mt-6 flex w-full max-w-xl items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-left shadow-sm backdrop-blur"
          >
            <svg
              className="h-5 w-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M16.65 11a5.65 5.65 0 11-11.3 0 5.65 5.65 0 0111.3 0z"
              />
            </svg>
            <span className="flex-1 text-sm text-slate-400">
              Search the documentation…
            </span>
            <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-400">
              ⌘K
            </kbd>
          </button>

          <div className="mt-5 flex items-center gap-6 text-sm text-slate-400">
            <span>
              <span className="font-semibold text-slate-700">
                {PRODUCTS.length}
              </span>{" "}
              areas
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>
              <span className="font-semibold text-slate-700">{totalDocs}</span>{" "}
              documents
            </span>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-5xl px-6 py-10 sm:px-8">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Browse by area
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          {PRODUCTS.map((product) => (
            <div
              key={product.id}
              onClick={() => onSelectProduct(product)}
              className="flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <ProductIcon id={product.id} className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {product.docs.length} docs
                </span>
              </div>

              <h3 className="mb-1.5 text-lg font-semibold text-slate-900">
                {product.name}
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-slate-500">
                {product.description}
              </p>

              {product.docs.length > 0 && (
                <ul className="mt-auto space-y-0.5 border-t border-slate-100 pt-3">
                  {product.docs.slice(0, 3).map((doc) => (
                    <li key={doc.id}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDoc(product, doc);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-sm text-slate-600"
                      >
                        <span className="truncate">{doc.title}</span>
                        <svg
                          className="h-4 w-4 shrink-0 text-slate-300"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
