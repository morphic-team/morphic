import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { SearchResultsService } from '../services/search-results.service'; // Adjust the path as necessary
import { FormsModule } from '@angular/forms'; // Import FormsModule
import { NgxPaginationModule } from 'ngx-pagination'; // Import NgxPaginationModule
import { SearchResult } from '../models/search-result.model';
import { CommonModule } from '@angular/common';

enum CompletionState {
  DONE = 'DONE',
  REVISIT = 'REVISIT',
  NOT_USABLE = 'NOT_USABLE'
}

@Component({
    selector: 'app-search-results-list',
    imports: [CommonModule, RouterModule, FormsModule, NgxPaginationModule], // Add NgxPaginationModule here
    templateUrl: './search-results-list.component.html',
    styleUrls: ['./search-results-list.component.css'] // Adjust if necessary
})
export class SearchResultsListComponent implements OnInit, AfterViewInit {
  searchResults: SearchResult[] = [];
  currentPage: number = 1; // Change to 1-based index
  perPage: number = 60;
  totalSearchResults: number = 0; // Initialize total search results
  surveyId: string | null = null; // Store the survey ID
  highlightResultId: number | null = null; // Result ID to highlight
  completionStateFilter: CompletionState | null = null; // Filter by completion state
  
  // Per-page options
  perPageOptions = [20, 60, 100, 200];
  
  // Expose enum to template
  CompletionState = CompletionState;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private searchResultsService: SearchResultsService // Make sure this service exists
  ) {}

  ngOnInit(): void {
    const surveyIdFromParams = this.route.parent?.snapshot.paramMap.get('id');
    this.surveyId = surveyIdFromParams !== undefined ? surveyIdFromParams : null;

    // Subscribe to route parameter changes to handle page navigation
    this.route.paramMap.subscribe(params => {
      const pageParam = params.get('page');
      this.currentPage = pageParam ? Number(pageParam) : 1;
      
      if (this.surveyId) {
        this.getSearchResults();
      } else {
        console.error('Survey ID not found in route parameters');
      }
    });
    
    // Subscribe to query parameter changes to handle highlighting
    this.route.queryParamMap.subscribe(queryParams => {
      const highlightParam = queryParams.get('highlight');
      this.highlightResultId = highlightParam ? Number(highlightParam) : null;
    });
  }


  getSearchResults(): void {
    if (this.surveyId) {
      this.searchResultsService.getSearchResults(this.surveyId, this.completionStateFilter, this.currentPage, this.perPage).subscribe({
        next: (response) => {
          this.searchResults = response.results;
          this.totalSearchResults = response.count;
          // Scroll to highlighted result after data loads
          setTimeout(() => this.scrollToHighlightedResult(), 100);
        },
        error: (error) => {
          console.error('Error fetching search results:', error);
        }
      });
    }
  }


  onPageChange(page: number): void {
    // Navigate to the selected page
    if (this.surveyId) {
      this.router.navigate(['/surveys', this.surveyId, 'search-results', 'page', page]);
    }
  }

  onFilterChange(): void {
    // Reset to page 1 when filtering changes
    this.currentPage = 1;
    // Immediately fetch new results with the filter
    this.getSearchResults();
    // Also update the URL to reflect page 1
    if (this.surveyId) {
      this.router.navigate(['/surveys', this.surveyId, 'search-results', 'page', 1]);
    }
  }

  onPerPageChange(): void {
    // Reset to page 1 when per-page changes
    this.currentPage = 1;
    // Immediately fetch new results with the new per-page setting
    this.getSearchResults();
    // Also update the URL to reflect page 1
    if (this.surveyId) {
      this.router.navigate(['/surveys', this.surveyId, 'search-results', 'page', 1]);
    }
  }

  getProcessingStatusText(imageScrapedState: string): string {
    switch (imageScrapedState) {
      case 'NEW': return 'Pending';
      case 'STARTED': return 'Processing...';
      case 'SUCCESS': return 'Processed';
      case 'FAILURE': return 'Failed';
      default: return 'Unknown';
    }
  }

  getProcessingBadgeClass(imageScrapedState: string): string {
    switch (imageScrapedState) {
      case 'NEW': return 'bg-secondary';
      case 'STARTED': return 'bg-info';
      case 'SUCCESS': return 'bg-success';
      case 'FAILURE': return 'bg-danger';
      default: return 'bg-light';
    }
  }

  getCompletionStateText(completionState: string): string {
    switch (completionState) {
      case 'DONE': return 'Done';
      case 'REVISIT': return 'Revisit';
      case 'NOT_USABLE': return 'Not Usable';
      default: return completionState;
    }
  }

  getDuplicateProcessingText(searchResult: any): string {
    if (searchResult.duplicateOfId) {
      return `Duplicate of #${searchResult.duplicateOfId}`;
    }
    
    // Check processing state to determine if it's canonical or still processing
    switch (searchResult.imageScrapedState) {
      case 'NEW': return 'Unprocessed';
      case 'STARTED': return 'Processing';
      case 'SUCCESS': return 'Canonical';
      case 'FAILURE': return 'Processing Failed';
      default: return 'Canonical';
    }
  }

  getDuplicateProcessingBadgeClass(searchResult: any): string {
    if (searchResult.duplicateOfId) {
      return 'bg-danger';
    }
    
    switch (searchResult.imageScrapedState) {
      case 'NEW': return 'bg-secondary';
      case 'STARTED': return 'bg-info';
      case 'SUCCESS': return 'bg-success';
      case 'FAILURE': return 'bg-danger';
      default: return 'bg-success';
    }
  }

  getImageFilename(directLink: string): string {
    if (!directLink) {
      return 'Unknown';
    }
    
    try {
      // Extract filename from URL path
      const url = new URL(directLink);
      const pathname = url.pathname;
      const filename = pathname.split('/').pop();
      return filename || 'Unknown';
    } catch (error) {
      // If URL parsing fails, try to extract from string
      const parts = directLink.split('/');
      return parts[parts.length - 1] || 'Unknown';
    }
  }

  ngAfterViewInit(): void {
    // Initial scroll after view is fully initialized
    setTimeout(() => this.scrollToHighlightedResult(), 200);
  }

  private scrollToHighlightedResult(): void {
    if (this.highlightResultId) {
      const highlightedRow = document.querySelector(`tr[data-result-id="${this.highlightResultId}"]`);
      if (highlightedRow) {
        highlightedRow.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }
  }
}