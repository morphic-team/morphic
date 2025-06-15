import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SurveysService } from '../services/surveys.service';
import { Survey } from '../models/survey.model';
import { SurveyBuilderComponent } from '../survey-builder/survey-builder.component';
import { SurveyPreviewComponent } from '../survey-preview/survey-preview.component';

@Component({
  selector: 'app-create-survey',
  imports: [CommonModule, FormsModule, RouterModule, SurveyBuilderComponent, SurveyPreviewComponent],
  templateUrl: './create-survey.component.html',
  styleUrls: ['./create-survey.component.css']
})
export class CreateSurveyComponent {
  survey: Survey = {
    name: '',
    comments: '',
    fields: [],
    isMutable: true
  };
  
  errorMessage = '';
  isSubmitting = false;

  constructor(private surveysService: SurveysService, private router: Router) {}

  onSurveyChange(updatedSurvey: Survey) {
    this.survey = { ...updatedSurvey };
  }

  createSurvey() {
    this.errorMessage = '';
    
    // Basic validation
    if (!this.survey.name.trim()) {
      this.errorMessage = 'Survey name is required.';
      return;
    }

    if (this.survey.name.trim().length < 3) {
      this.errorMessage = 'Survey name must be at least 3 characters long.';
      return;
    }

    if (this.survey.fields.length === 0) {
      this.errorMessage = 'Please add at least one field to the survey.';
      return;
    }

    this.isSubmitting = true;

    // Prepare survey data for API
    const surveyData = {
      name: this.survey.name.trim(),
      comments: this.survey.comments.trim(),
      fields: this.survey.fields
    };

    this.surveysService.createSurvey(surveyData).subscribe({
      next: (response) => {
        this.router.navigate(['/surveys']);  // Redirect back to surveys list
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = 'Failed to create survey. Please try again.';
      }
    });
  }

  cancel() {
    this.router.navigate(['/surveys']);
  }
}