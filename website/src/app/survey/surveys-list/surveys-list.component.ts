import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SurveysService } from '../services/surveys.service'; // Adjust path as needed
import { ExportModalComponent } from '../export-modal/export-modal.component';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-survey-list',
    imports: [CommonModule, FormsModule, RouterModule, ExportModalComponent], // Import necessary modules for *ngFor, routing
    templateUrl: './surveys-list.component.html',
    styleUrls: ['./surveys-list.component.css'] // Corrected from 'styleUrl' to 'styleUrls'
})
export class SurveyListComponent implements OnInit {
  surveys$: Observable<any[]> | null = null;  // Initialize with null
  
  // Export modal state
  showExportModal: boolean = false;
  selectedSurveyForExport: any = null;
  
  // Archive filter state
  showArchived: boolean = false;

  constructor(private surveysService: SurveysService, private router: Router) {}

  ngOnInit(): void {
    // Fetch surveys on component initialization (default: exclude archived)
    this.refreshSurveys();
  }
  
  refreshSurveys(): void {
    this.surveys$ = this.surveysService.refresh(this.showArchived);
  }

  goToSurveyDetails(surveyId: string): void {
    // Navigate to the details of the selected survey
    this.router.navigate([`/surveys/${surveyId}/search-results`]);
  }

  createSurvey(): void {
    // Navigate to the survey creation page
    this.router.navigate(['/surveys/create']);
  }

  openExportModal(survey: any): void {
    this.selectedSurveyForExport = survey;
    this.showExportModal = true;
  }

  closeExportModal(): void {
    this.showExportModal = false;
    this.selectedSurveyForExport = null;
  }

  archiveSurvey(survey: any): void {
    if (confirm(`Are you sure you want to archive "${survey.name}"?`)) {
      this.surveysService.archiveSurvey(survey.id).subscribe({
        next: () => {
          // Refresh the surveys list to reflect the change
          this.refreshSurveys();
        },
        error: (error) => {
          console.error('Error archiving survey:', error);
          alert('Failed to archive survey. Please try again.');
        }
      });
    }
  }

  unarchiveSurvey(survey: any): void {
    if (confirm(`Are you sure you want to unarchive "${survey.name}"?`)) {
      this.surveysService.unarchiveSurvey(survey.id).subscribe({
        next: () => {
          // Refresh the surveys list to reflect the change
          this.refreshSurveys();
        },
        error: (error) => {
          console.error('Error unarchiving survey:', error);
          alert('Failed to unarchive survey. Please try again.');
        }
      });
    }
  }
}