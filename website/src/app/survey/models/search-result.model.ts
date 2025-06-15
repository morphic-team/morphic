
export interface SearchResult {
  id: number;
  nextId: number | null;
  previousId: number | null;
  searchId: number;
  imageId: number;
  visibleLink: string;
  directLink: string;
  completionState: string;
  duplicateOfId: number | null;
  imageScrapedState: string;
  duplicatePool: SearchResult[];
  fieldValues?: Record<string, any>;
  search?: any;
}

export interface SearchResultsResponse {
  count: number;
  limit: number;
  offset: number;
  results: SearchResult[];
}
