import { Routes } from '@angular/router';
import { InstructionsComponent } from './instructions/instructions.component';
import { PrivacyComponent } from './privacy/privacy.component';
import { ChangelogComponent } from './changelog/changelog.component';
import { SignInComponent } from './sign-in/sign-in.component';
import { SignUpComponent } from './sign-up/sign-up.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { AuthGuard } from './auth.guard';
import { UnsavedChangesGuard } from './survey/guards/unsaved-changes.guard';
import { SurveyListComponent } from './survey/surveys-list/surveys-list.component';
import { SurveyDetailComponent } from './survey/survey-detail/survey-detail.component';
import { SearchResultsListComponent } from './survey/search-results-list/search-results-list.component';
import { SearchResultDetailComponent } from './survey/search-result-detail/search-result-detail.component';
import { ExportResultsComponent } from './survey/export-results/export-results.component';
import { SearchesListComponent } from './survey/searches-list/searches-list.component';
import { CreateSurveyComponent } from './survey/create-survey/create-survey.component';
import { CreateSearchComponent } from './survey/create-search/create-search.component';

export const routes: Routes = [
  { path: 'instructions', component: InstructionsComponent },
  { path: 'changelog', component: ChangelogComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: 'sign-in', component: SignInComponent },
  { path: 'sign-up', component: SignUpComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },

  { 
    path: 'surveys', 
    component: SurveyListComponent, 
    canActivate: [AuthGuard] 
  },
  {
    path: 'surveys/create',
    component: CreateSurveyComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'surveys/:id', 
    component: SurveyDetailComponent, 
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        redirectTo: 'searches',
        pathMatch: 'full'
      },
      {
        path: 'search-results/page/:page',
        component: SearchResultsListComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'search-results',
        redirectTo: 'search-results/page/1'
      },
      {
        path: 'search-results/page/:page/result/:resultId',
        component: SearchResultDetailComponent,
        canActivate: [AuthGuard],
        canDeactivate: [UnsavedChangesGuard]
      },
      {
        path: 'search-results/:resultId',
        redirectTo: 'search-results/page/1/result/:resultId'
      },
      {
        path: 'export-results',
        component: ExportResultsComponent, 
        canActivate: [AuthGuard]
      },
      {
        path: 'searches',
        component: SearchesListComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'searches/create',
        component: CreateSearchComponent,
        canActivate: [AuthGuard]
      }
    ]
  },

  { path: '', redirectTo: '/surveys', pathMatch: 'full' },
];