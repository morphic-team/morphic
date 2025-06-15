import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SearchesService, CreateSearchRequest } from '../services/searches.service';

@Component({
  selector: 'app-create-search',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './create-search.component.html',
  styleUrl: './create-search.component.css'
})
export class CreateSearchComponent implements OnInit {
  searchForm: FormGroup;
  surveyId: string | null = null;
  isSubmitting = false;
  submitError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private searchesService: SearchesService
  ) {
    this.searchForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1)]],
      searchQuery: ['', [Validators.required, Validators.minLength(1)]],
      comments: ['']
    });
  }

  ngOnInit(): void {
    this.surveyId = this.route.parent?.snapshot.paramMap.get('id') || null;
    if (!this.surveyId) {
      this.router.navigate(['/surveys']);
    }
  }

  onSubmit(): void {
    if (this.searchForm.valid && this.surveyId && !this.isSubmitting) {
      this.isSubmitting = true;
      this.submitError = null;

      const formData: CreateSearchRequest = this.searchForm.value;
      
      this.searchesService.createSearch(this.surveyId, formData)
        .subscribe({
          next: (response) => {
            this.router.navigate(['../'], { relativeTo: this.route });
          },
          error: (error) => {
            this.isSubmitting = false;
            this.submitError = 'Failed to create search. Please try again.';
            console.error('Error creating search:', error);
          }
        });
    }
  }

  onCancel(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  getFieldError(fieldName: string): string | null {
    const field = this.searchForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      }
      if (field.errors['minlength']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
    }
    return null;
  }
}
