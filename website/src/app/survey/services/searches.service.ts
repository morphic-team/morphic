import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Search {
  id: number;
  name: string;
  searchQuery: string;
  comments: string;
  areResultsUploaded: boolean;
}

export interface SearchesResponse {
  results: Search[];
  count?: number;
}

export interface CreateSearchRequest {
  name: string;
  searchQuery: string;
  comments?: string;
}

export interface GenerateUploadUrlRequest {
  limit: number;
}

export interface GenerateUploadUrlResponse {
  googleSearchUrl: string;  // camelCase due to interceptor
  limit: number;
  expiresIn: number;  // camelCase due to interceptor
}

@Injectable({
  providedIn: 'root'
})
export class SearchesService {
  constructor(private http: HttpClient) {}

  // Get all searches for a survey
  getSearches(surveyId: string): Observable<SearchesResponse> {
    return this.http.get<SearchesResponse>(`/api/surveys/${surveyId}/searches`);
  }

  // Get a specific search by ID
  getSearch(searchId: string): Observable<Search> {
    return this.http.get<Search>(`/api/searches/${searchId}`);
  }

  // Create a new search
  createSearch(surveyId: string, searchData: CreateSearchRequest): Observable<Search> {
    return this.http.post<Search>(`/api/surveys/${surveyId}/searches`, searchData);
  }

  // Generate upload URL for gathering results
  generateUploadUrl(searchId: number, limit: number): Observable<GenerateUploadUrlResponse> {
    const request: GenerateUploadUrlRequest = { limit };
    return this.http.post<GenerateUploadUrlResponse>(`/api/searches/${searchId}/generate-upload-url`, request);
  }
}