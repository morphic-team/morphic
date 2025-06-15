import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { SurveysService } from '../services/surveys.service';
import { SearchResultsService } from '../services/search-results.service';

@Component({
    selector: 'app-export-results',
    imports: [CommonModule],
    templateUrl: './export-results.component.html',
    styleUrl: './export-results.component.css'
})
export class ExportResultsComponent implements OnInit {
  surveyId: string | null = null;
  survey: any = null;
  resultsCount: number = 0;
  isLoading: boolean = true;
  isDownloading: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private surveysService: SurveysService,
    private searchResultsService: SearchResultsService
  ) {}

  ngOnInit(): void {
    this.route.parent?.paramMap.subscribe(params => {
      this.surveyId = params.get('id');
      if (this.surveyId) {
        this.loadSurveyData();
      }
    });
  }

  loadSurveyData(): void {
    if (!this.surveyId) return;

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
      },
      error: (error) => {
        console.error('Error downloading results:', error);
        this.isDownloading = false;
        alert('Failed to download results. Please try again.');
      }
    });
  }
}
