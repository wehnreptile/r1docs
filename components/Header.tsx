import React from "react";

interface HeaderProps {
  onOpenSearch: () => void;
  onGoHome: () => void;
  isHome: boolean;
}

const Header: React.FC<HeaderProps> = ({ onOpenSearch, onGoHome, isHome }) => {
  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between z-10 sticky top-0">
      <div
        className="flex items-center space-x-4 cursor-pointer"
        onClick={onGoHome}
      >
        <div className="bg-indigo-600 p-2 rounded-lg">
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h1 className="font-bold text-xl tracking-tight text-slate-800">
          Reptile documentation.
        </h1>
      </div>

      <div className="flex items-center space-x-6">
        <button
          onClick={onOpenSearch}
          className="flex items-center space-x-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-4 py-2 rounded-full text-slate-500 transition-colors w-64"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M16.65 11a5.65 5.65 0 11-11.3 0 5.65 5.65 0 0111.3 0z"
            />
          </svg>
          <span className="text-sm">Search docs...</span>
          <span className="ml-auto text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-400">
            ⌘K
          </span>
        </button>

        <nav className="hidden md:flex space-x-6 font-medium text-sm text-slate-600">
          <a
            href="#"
            className="hover:text-indigo-600 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              onGoHome();
            }}
          >
            Portal
          </a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
