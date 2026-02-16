
import React, { useState, useEffect } from 'react';
import { AppRoute, Product, DocPage } from './types';
import { PRODUCTS } from './constants';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ContentArea from './components/ContentArea';
import SearchModal from './components/SearchModal';
import LandingPage from './components/LandingPage';

const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(AppRoute.HOME);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activeDoc, setActiveDoc] = useState<DocPage | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigateToProduct = (product: Product) => {
    setActiveProduct(product);
    setActiveDoc(product.docs[0] || null);
    setCurrentRoute(AppRoute.PRODUCT);
    window.scrollTo(0, 0);
  };

  const navigateToHome = () => {
    setActiveProduct(null);
    setActiveDoc(null);
    setCurrentRoute(AppRoute.HOME);
    window.scrollTo(0, 0);
  };

  const navigateToDoc = (doc: DocPage) => {
    setActiveDoc(doc);
    setCurrentRoute(AppRoute.PRODUCT);
    window.scrollTo(0, 0);
  };

  const navigateToNextDoc = () => {
    if (!activeProduct || !activeDoc) return;
    const idx = activeProduct.docs.findIndex(d => d.id === activeDoc.id);
    if (idx < activeProduct.docs.length - 1) {
      navigateToDoc(activeProduct.docs[idx + 1]);
    }
  };

  const navigateToPrevDoc = () => {
    if (!activeProduct || !activeDoc) return;
    const idx = activeProduct.docs.findIndex(d => d.id === activeDoc.id);
    if (idx > 0) {
      navigateToDoc(activeProduct.docs[idx - 1]);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 selection:bg-indigo-100">
      {/* Sidebar - only shown on product pages */}
      {currentRoute === AppRoute.PRODUCT && activeProduct && (
        <Sidebar 
          product={activeProduct} 
          activeDocId={activeDoc?.id || ''} 
          onSelectDoc={navigateToDoc}
          onGoHome={navigateToHome}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          onOpenSearch={() => setIsSearchOpen(true)} 
          onGoHome={navigateToHome}
          isHome={currentRoute === AppRoute.HOME}
        />

        <main className="flex-1 overflow-y-auto">
          {currentRoute === AppRoute.HOME ? (
            <LandingPage onSelectProduct={navigateToProduct} />
          ) : (
            activeDoc && (
              <ContentArea 
                doc={activeDoc} 
                productName={activeProduct?.name || ''} 
                onNext={navigateToNextDoc}
                onPrev={navigateToPrevDoc}
                hasNext={activeProduct ? activeProduct.docs.findIndex(d => d.id === activeDoc.id) < activeProduct.docs.length - 1 : false}
                hasPrev={activeProduct ? activeProduct.docs.findIndex(d => d.id === activeDoc.id) > 0 : false}
              />
            )
          )}
        </main>
      </div>

      <SearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)}
        onSelectDoc={(prod, doc) => {
          setActiveProduct(prod);
          setActiveDoc(doc);
          setCurrentRoute(AppRoute.PRODUCT);
          setIsSearchOpen(false);
          window.scrollTo(0, 0);
        }}
      />
    </div>
  );
};

export default App;
