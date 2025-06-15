import { Component, OnInit, ViewChild, HostListener } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { SearchResultsService } from '../services/search-results.service';
import { SurveysService } from '../services/surveys.service';
import { Survey } from '../models/survey.model';
import { SurveyFormComponent } from '../survey-form/survey-form.component';
import { SearchResultFormControlsComponent } from '../search-result-form-controls/search-result-form-controls.component';
import { CanComponentDeactivate } from '../guards/unsaved-changes.guard';

@Component({
    selector: 'app-search-result-detail',
    imports: [CommonModule, FormsModule, RouterModule, SurveyFormComponent, SearchResultFormControlsComponent],
    templateUrl: './search-result-detail.component.html',
    styleUrl: './search-result-detail.component.css'
})
export class SearchResultDetailComponent implements OnInit, CanComponentDeactivate {
  @ViewChild(SurveyFormComponent) surveyFormComponent!: SurveyFormComponent;
  
  surveyId: string | null = null;
  resultId: string | null = null;
  searchResult: any = null;
  survey: Survey | null = null;
  loading = true;
  saving = false;
  error: string | null = null;
  currentPage: number = 1;
  selectedCompletionState: string | null = null;
  
  // Unsaved changes tracking
  hasUnsavedChanges: boolean = false;
  originalFormValues: { [fieldId: string]: any } = {};
  originalCompletionState: string | null = null;
  changedFields: Set<string> = new Set();
  
  // Navigation context
  pageResults: any[] = [];
  currentIndex: number = -1;
  totalResults: number = 0;
  perPage: number = 60;
  
  // Return context for back navigation
  returnPage: number | null = null;
  returnResultId: number | null = null;
  
  // Image loading state
  imageLoaded: boolean = false;
  imageError: boolean = false;
  
  // Image source switching
  showCachedImage: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private searchResultsService: SearchResultsService,
    private surveysService: SurveysService
  ) {}

  ngOnInit() {
    // Subscribe to route parameter changes to handle navigation within same component
    this.route.paramMap.subscribe(params => {
      this.resultId = params.get('resultId');
      const pageParam = params.get('page');
      this.currentPage = pageParam ? Number(pageParam) : 1;
      
      this.surveyId = this.route.parent?.snapshot.paramMap.get('id') || null;

      if (this.surveyId && this.resultId) {
        this.loading = true;
        this.error = null;
        this.loadData();
      } else {
        this.error = 'Missing survey ID or result ID';
        this.loading = false;
      }
    });
    
    // Subscribe to query parameter changes to capture return context
    this.route.queryParamMap.subscribe(queryParams => {
      const returnPageParam = queryParams.get('returnPage');
      const returnResultParam = queryParams.get('returnResult');
      this.returnPage = returnPageParam ? Number(returnPageParam) : null;
      this.returnResultId = returnResultParam ? Number(returnResultParam) : null;
    });
  }

  private loadData() {
    Promise.all([
      this.surveysService.getSurvey(this.surveyId!).toPromise(),
      this.searchResultsService.getSearchResult(Number(this.resultId!)).toPromise(),
      this.searchResultsService.getSearchResults(this.surveyId!, '', this.currentPage, 60).toPromise()
    ]).then(([survey, searchResult, pageResultsResponse]) => {
      if (!survey || !searchResult || !pageResultsResponse) {
        throw new Error('Failed to load required data');
      }
      
      this.survey = survey;
      this.searchResult = searchResult;
      this.pageResults = pageResultsResponse.results;
      this.totalResults = pageResultsResponse.count;
      
      // Initialize completion state from loaded data
      this.selectedCompletionState = searchResult.completionState;
      this.originalCompletionState = searchResult.completionState;
      
      // Store original form values for change tracking
      this.originalFormValues = { ...this.getInitialFormValues() };
      this.hasUnsavedChanges = false;
      this.changedFields.clear();
      
      // Reset image loading state
      this.imageLoaded = false;
      this.imageError = false;
      // Default to cached image if available, otherwise show live image
      this.showCachedImage = !!(this.searchResult && this.searchResult.cachedImageUrl);
      
      // Find current result's index in the page
      this.currentIndex = this.pageResults.findIndex(r => r.id === Number(this.resultId));
      
      this.loading = false;
    }).catch(error => {
      console.error('Error loading data:', error);
      this.error = 'Failed to load data';
      this.loading = false;
    });
  }

  onFieldChange(event: { fieldId: string, value: any, allValues: { [fieldId: string]: any } }) {
    // Check if this specific field has changed from its original value
    const originalValue = this.originalFormValues[event.fieldId];
    const hasChanged = JSON.stringify(event.value) !== JSON.stringify(originalValue);
    
    if (hasChanged) {
      this.changedFields.add(event.fieldId);
    } else {
      this.changedFields.delete(event.fieldId);
    }
    
    this.updateUnsavedChangesStatus();
  }

  onCompletionStateChange() {
    this.updateUnsavedChangesStatus();
  }

  private updateUnsavedChangesStatus() {
    // Check completion state changes
    const stateChanged = this.selectedCompletionState !== this.originalCompletionState;
    
    // Overall unsaved changes = any field changed OR completion state changed
    this.hasUnsavedChanges = this.changedFields.size > 0 || stateChanged;
  }

  revertChanges() {
    if (!confirm('Are you sure you want to revert all changes? This will permanently discard your unsaved work.')) {
      return;
    }
    
    // Revert completion state
    this.selectedCompletionState = this.originalCompletionState;
    
    // Clear changed fields tracking
    this.changedFields.clear();
    
    // Reset the survey form to original values
    if (this.surveyFormComponent) {
      this.surveyFormComponent.resetForm();
    }
    
    // Update the unsaved changes status
    this.updateUnsavedChangesStatus();
  }

  saveForm() {
    if (!this.resultId || this.saving) return;

    this.saving = true;
    this.error = null;

    // Get current form values from the survey form component
    const formValues = this.surveyFormComponent ? this.surveyFormComponent.formValues : {};

    this.searchResultsService.updateSearchResult(
      Number(this.resultId), 
      formValues, 
      this.selectedCompletionState || undefined
    ).subscribe({
      next: (updatedResult) => {
        this.searchResult = updatedResult;
        
        // Reset unsaved changes tracking after successful save
        this.originalFormValues = { ...formValues };
        this.originalCompletionState = this.selectedCompletionState;
        this.changedFields.clear();
        this.hasUnsavedChanges = false;
        this.saving = false;
      },
      error: (error) => {
        console.error('Error saving form:', error);
        this.error = 'Failed to save form data';
        this.saving = false;
      }
    });
  }

  saveAndNext(completionState: string) {
    if (!this.resultId || this.saving || !this.hasNext) return;

    this.saving = true;
    this.error = null;

    // Get current form values from the survey form component
    const formValues = this.surveyFormComponent ? this.surveyFormComponent.formValues : {};

    this.searchResultsService.updateSearchResult(
      Number(this.resultId), 
      formValues, 
      completionState
    ).subscribe({
      next: (updatedResult) => {
        this.searchResult = updatedResult;
        
        // Reset unsaved changes tracking after successful save
        this.originalFormValues = { ...formValues };
        this.originalCompletionState = completionState;
        this.selectedCompletionState = completionState;
        this.changedFields.clear();
        this.hasUnsavedChanges = false;
        this.saving = false;
        
        // Navigate to next result
        this.navigateToNext();
      },
      error: (error) => {
        console.error('Error saving form:', error);
        this.error = 'Failed to save form data';
        this.saving = false;
      }
    });
  }

  private navigateToNext() {
    if (!this.surveyId) return;

    if (this.currentIndex < this.pageResults.length - 1) {
      // Navigate to next result on current page
      const nextResult = this.pageResults[this.currentIndex + 1];
      this.router.navigate(['/surveys', this.surveyId, 'search-results', 'page', this.currentPage, 'result', nextResult.id]);
    } else if (this.hasMorePages()) {
      // Navigate to first result of next page - fetch it first
      this.searchResultsService.getSearchResults(this.surveyId, '', this.currentPage + 1, this.perPage).subscribe(response => {
        if (response.results && response.results.length > 0) {
          const firstResult = response.results[0];
          this.router.navigate(['/surveys', this.surveyId, 'search-results', 'page', this.currentPage + 1, 'result', firstResult.id]);
        }
      });
    }
  }

  canDeactivate(): boolean | Observable<boolean> {
    return !this.hasUnsavedChanges;
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.hasUnsavedChanges) {
      $event.returnValue = true;
    }
  }

  onFormSubmit(formValues: { [fieldId: string]: any }) {
    if (!this.resultId || this.saving) return;

    this.saving = true;
    this.error = null;

    // formValues already uses field labels as keys, so we can pass directly
    this.searchResultsService.updateSearchResult(
      Number(this.resultId), 
      formValues, 
      this.selectedCompletionState || undefined
    ).subscribe({
      next: (updatedResult) => {
        this.searchResult = updatedResult;
        this.saving = false;
        
        // Reset unsaved changes tracking after successful save
        this.originalFormValues = { ...formValues };
        this.originalCompletionState = this.selectedCompletionState;
        this.changedFields.clear();
        this.hasUnsavedChanges = false;
      },
      error: (error) => {
        console.error('Error saving form:', error);
        this.error = 'Failed to save form data';
        this.saving = false;
      }
    });
  }

  goBackToResults() {
    if (this.surveyId) {
      // Use return context if available, otherwise use current context
      const targetPage = this.returnPage || this.currentPage;
      const highlightResult = this.returnResultId || this.resultId;
      
      this.router.navigate(['/surveys', this.surveyId, 'search-results', 'page', targetPage], {
        queryParams: { highlight: highlightResult }
      });
    }
  }

  goToPrevious() {
    if (!this.surveyId) return;

    if (this.currentIndex > 0) {
      // Navigate to previous result on current page
      const prevResult = this.pageResults[this.currentIndex - 1];
      this.router.navigate(['/surveys', this.surveyId, 'search-results', 'page', this.currentPage, 'result', prevResult.id]);
    } else if (this.currentPage > 1) {
      // Navigate to last result of previous page - fetch it first
      this.searchResultsService.getSearchResults(this.surveyId, '', this.currentPage - 1, this.perPage).subscribe(response => {
        if (response.results && response.results.length > 0) {
          const lastResult = response.results[response.results.length - 1];
          this.router.navigate(['/surveys', this.surveyId, 'search-results', 'page', this.currentPage - 1, 'result', lastResult.id]);
        }
      });
    }
  }

  goToNext() {
    if (!this.surveyId) return;

    if (this.currentIndex < this.pageResults.length - 1) {
      // Navigate to next result on current page
      const nextResult = this.pageResults[this.currentIndex + 1];
      this.router.navigate(['/surveys', this.surveyId, 'search-results', 'page', this.currentPage, 'result', nextResult.id]);
    } else if (this.hasMorePages()) {
      // Navigate to first result of next page - fetch it first
      this.searchResultsService.getSearchResults(this.surveyId, '', this.currentPage + 1, this.perPage).subscribe(response => {
        if (response.results && response.results.length > 0) {
          const firstResult = response.results[0];
          this.router.navigate(['/surveys', this.surveyId, 'search-results', 'page', this.currentPage + 1, 'result', firstResult.id]);
        }
      });
    }
  }

  get hasPrevious(): boolean {
    // Disable navigation when in return context (viewing via duplicate link)
    if (this.returnPage !== null || this.returnResultId !== null) {
      return false;
    }
    return this.currentIndex > 0 || this.currentPage > 1;
  }

  get hasNext(): boolean {
    // Disable navigation when in return context (viewing via duplicate link)
    if (this.returnPage !== null || this.returnResultId !== null) {
      return false;
    }
    return this.currentIndex < this.pageResults.length - 1 || this.hasMorePages();
  }

  private hasMorePages(): boolean {
    const totalPages = Math.ceil(this.totalResults / this.perPage);
    return this.currentPage < totalPages;
  }


  getInitialFormValues(): { [fieldId: string]: any } {
    if (!this.searchResult?.fieldValues || !this.survey) {
      return {};
    }

    const initialValues: { [fieldId: string]: any } = {};
    for (const field of this.survey.fields) {
      const fieldId = field.id.toString();
      let value = this.searchResult.fieldValues[fieldId];
      
      // Parse JSON strings for location fields
      if (field.fieldType === 'location' && typeof value === 'string' && value.startsWith('{')) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          console.warn('Failed to parse location JSON:', value, e);
        }
      }
      
      if (value !== undefined) {
        initialValues[fieldId] = value;
      } else if (field.fieldType === 'location') {
        // Set location fields to null when no value to match LocationPicker's initial state
        initialValues[fieldId] = null;
      }
    }
    return initialValues;
  }

  onImageLoad() {
    this.imageLoaded = true;
    this.imageError = false;
  }

  onImageError(event: any) {
    this.imageError = true;
    this.imageLoaded = false;
    console.warn('Failed to load search result image:', event);
  }

  getDisplayUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Return domain + path, truncated if too long
      const displayUrl = urlObj.hostname + urlObj.pathname;
      return displayUrl.length > 50 ? displayUrl.substring(0, 47) + '...' : displayUrl;
    } catch {
      // Fallback for invalid URLs
      return url.length > 50 ? url.substring(0, 47) + '...' : url;
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

  getCompletionStateDisplayText(completionState: string): string {
    switch (completionState) {
      case 'DONE': return 'Done';
      case 'REVISIT': return 'Revisit';
      case 'NOT_USABLE': return 'Not Usable';
      default: return completionState;
    }
  }

  getCurrentImageSrc(): string {
    if (!this.searchResult) return '';
    
    if (this.showCachedImage && this.searchResult.cachedImageUrl) {
      return this.searchResult.cachedImageUrl;
    } else {
      return this.searchResult.directLink;
    }
  }

  toggleImageSource(): void {
    // Only allow toggling to cached image if one exists
    if (!this.showCachedImage || this.hasCachedImage) {
      this.showCachedImage = !this.showCachedImage;
      this.imageLoaded = false;
      this.imageError = false;
    }
  }

  get hasCachedImage(): boolean {
    return !!(this.searchResult && this.searchResult.cachedImageUrl);
  }
}
