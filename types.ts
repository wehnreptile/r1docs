export interface DocPage {
  id: string;
  title: string;
  slug: string;
  category: string;
  contentPath: string;
  lastUpdated: string;
}

export interface Product {
  id: string;
  name: string;
  icon: string;
  description: string;
  docs: DocPage[];
}

export enum AppRoute {
  HOME = "home",
  PRODUCT = "product",
  SEARCH = "search",
}

export interface SearchResult {
  productId: string;
  docId: string;
  title: string;
  snippet: string;
  relevance: number;
}
