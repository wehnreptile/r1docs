import React from "react";

interface HeaderProps {
  onOpenSearch: () => void;
  onGoHome: () => void;
  isHome: boolean;
  showMenu?: boolean;
  onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onGoHome,
  showMenu = false,
  onToggleSidebar,
}) => {
  return (
    <header className="h-16 border-b border-slate-200 bg-white px-4 sm:px-6 flex items-center justify-between z-10 sticky top-0">
      <div className="flex items-center gap-2 sm:gap-3">
        {showMenu && (
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            className="md:hidden -ml-1 p-2 rounded-lg text-slate-600 hover:bg-slate-100"
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
                d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
              />
            </svg>
          </button>
        )}
        <div className="flex items-center cursor-pointer" onClick={onGoHome}>
          <h1 className="font-bold text-xl tracking-tight text-slate-900">
            Reptile Docs
          </h1>
        </div>
      </div>

      <div className="flex items-center">
        <button
          onClick={onOpenSearch}
          aria-label="Search docs"
          className="flex items-center gap-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 sm:px-4 py-2 rounded-full text-slate-500 transition-colors sm:w-64"
        >
          <svg
            className="w-4 h-4 shrink-0"
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
          <span className="hidden sm:block text-sm">Search docs...</span>
          <span className="ml-auto hidden sm:block text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-400">
            ⌘K
          </span>
        </button>
      </div>
    </header>
  );
};

export default Header;
