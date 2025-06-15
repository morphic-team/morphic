import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { UserService } from '../../services/user.service';

@Injectable({
    providedIn: 'root'
})
export class SurveysService {
  surveys: any[] = [];

  constructor(private http: HttpClient, private userService: UserService) {}

  // Get a specific survey by ID
  getSurvey(surveyId: string): Observable<any> {
    return this.http.get(`/api/surveys/${surveyId}`);
  }

  // Refresh surveys list for the current user
  refresh(includeArchived: boolean = false): Observable<any[]> {
    return this.userService.getUser().pipe(
      switchMap(user => {
        // Make API call to get surveys for the user with archived filter
        const params = includeArchived ? '?is_archived=true' : '';
        return this.http.get<any>(`/api/users/${user.id}/surveys${params}`);
      }),
      map(response => {
        // Extract the surveys from the 'results' property in the API response
        const surveys = response.results;
        this.surveys = surveys;
        return surveys;
      })
    );
  }

  // Create a new survey
  createSurvey(surveyData: any): Observable<any> {
    return this.userService.getUser().pipe(
      switchMap(user => {
        return this.http.post(`/api/users/${user.id}/surveys`, surveyData);
      }),
      switchMap(() => this.refresh())  // Automatically refresh the list after creating a survey
    );
  }

  // Export survey results as CSV
  exportResults(surveyId: string): Observable<Blob> {
    return this.http.get(`/api/surveys/${surveyId}/export-results`, {
      responseType: 'blob'
    });
  }

  // Archive a survey
  archiveSurvey(surveyId: number): Observable<any> {
    return this.http.patch(`/api/surveys/${surveyId}`, { 
      is_archived: true 
    });
  }

  // Unarchive a survey
  unarchiveSurvey(surveyId: number): Observable<any> {
    return this.http.patch(`/api/surveys/${surveyId}`, { 
      is_archived: false 
    });
  }
}