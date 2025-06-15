import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SurveysService } from '../services/surveys.service';
import { SearchResultsService } from '../services/search-results.service';

@Component({
  selector: 'app-export-modal',
  imports: [CommonModule],
  templateUrl: './export-modal.component.html',
  styleUrl: './export-modal.component.css'
})
export class ExportModalComponent implements OnInit, OnChanges {
  @Input() surveyId: string | null = null;
  @Input() isVisible: boolean = false;
  @Output() close = new EventEmitter<void>();

  survey: any = null;
  resultsCount: number = 0;
  isLoading: boolean = true;
  isDownloading: boolean = false;

  constructor(
    private surveysService: SurveysService,
    private searchResultsService: SearchResultsService
  ) {}

  ngOnInit(): void {
    // Data will be loaded when modal becomes visible
  }

  ngOnChanges(): void {
    if (this.isVisible && this.surveyId && !this.survey) {
      this.loadSurveyData();
    }
  }

  loadSurveyData(): void {
    if (!this.surveyId) return;

    this.isLoading = true;

    // Load survey details
    this.surveysService.getSurvey(this.surveyId).subscribe({
      next: (survey) => {
        this.survey = survey;
      },
      error: (error) => {
        console.error('Error loading survey:', error);
      }
    });

    // Load search results count
    this.searchResultsService.getSearchResults(this.surveyId, '', 1, 1).subscribe({
      next: (response) => {
        this.resultsCount = response.count || 0;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading results count:', error);
        this.isLoading = false;
      }
    });
  }

  downloadCSV(): void {
    if (!this.surveyId || this.isDownloading) return;

    this.isDownloading = true;
    this.surveysService.exportResults(this.surveyId).subscribe({
      next: (blob) => {
        // Create a blob URL and trigger download
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Generate filename with survey name and current date
        const surveyName = this.survey?.name || 'survey';
        const date = new Date().toISOString().split('T')[0];
        link.download = `${surveyName}_results_${date}.csv`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        window.URL.revokeObjectURL(url);
        this.isDownloading = false;
        
        // Close modal after successful download
        this.closeModal();
      },
      error: (error) => {
        console.error('Error downloading results:', error);
        this.isDownloading = false;
        alert('Failed to download results. Please try again.');
      }
    });
  }

  closeModal(): void {
    this.close.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }
}