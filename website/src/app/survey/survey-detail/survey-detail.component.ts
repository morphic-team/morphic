import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SurveysService } from '../services/surveys.service'; // Adjust the path as needed
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common'; // Import CommonModule
import { RouterModule } from '@angular/router';


@Component({
    selector: 'app-survey-detail',
    imports: [CommonModule, RouterModule],
    templateUrl: './survey-detail.component.html',
    styleUrls: ['./survey-detail.component.css'] // Adjust if necessary
})
export class SurveyDetailComponent implements OnInit {
  survey$: Observable<any> | null = null;  // Observable for the survey data

  constructor(
    private route: ActivatedRoute, 
    private router: Router,
    private surveysService: SurveysService
  ) {}

  ngOnInit(): void {
    // Get the survey ID from the route parameters
    const surveyId = this.route.snapshot.paramMap.get('id');
    if (surveyId) {
      this.survey$ = this.surveysService.getSurvey(surveyId); // Fetch survey details
    }
  }

  isSearchResultDetailRoute(): boolean {
    // Check if current route is a search result detail page
    const url = this.router.url;
    return url.includes('/search-results/page/') && url.includes('/result/');
  }

  getCurrentSearchResultId(): string {
    // Extract search result ID from current URL
    const url = this.router.url;
    const match = url.match(/\/result\/(\d+)/);
    return match ? match[1] : '';
  }

  isCreateSearchRoute(): boolean {
    // Check if current route is the create search page
    const url = this.router.url;
    return url.includes('/searches/create');
  }
}
