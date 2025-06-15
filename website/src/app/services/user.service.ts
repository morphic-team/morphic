import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private user: any = null;
  private session: any = null;

  // BehaviorSubject to allow reactive access to user state
  private userSubject = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient, private storageService: StorageService) {
    this.loadFromStorage();
  }

  // Observable to allow components to reactively subscribe to user state
  getUser(): Observable<any> {
    return this.userSubject.asObservable();
  }

  // Checks if user is signed in
  isSignedIn(): boolean {
    return !!this.user;
  }

  // Sign-in method: posts credentials to the server
  signIn(email: string, password: string): Observable<any> {
    return this.http.post('/api/sessions', { email_address: email, password: password })
      .pipe(
        tap((response: any) => {
          this.session = response.session;
          this.user = response.user;
          this.persistToStorage();
          this.userSubject.next(this.user); // Update the observable
        })
      );
  }

  // Sign-up method: posts credentials to the server
  signUp(email: string, password: string): Observable<any> {
    return this.http.post('/api/users', { email_address: email, password: password })
      .pipe(
        tap((response: any) => {
          this.session = response.session;
          this.user = response.user;
          this.persistToStorage();
          this.userSubject.next(this.user); // Update the observable
        })
      );
  }

  // Sign-out method
  signOut(): void {
    this.user = null;
    this.session = null;
    this.storageService.clearSessionAndUser();
    this.userSubject.next(null); // Update the observable
  }

  // Persists the session and user to storage
  private persistToStorage(): void {
    this.storageService.setSessionAndUser({
      session: this.session,
      user: this.user
    });
  }

  // Loads the session and user from storage (if available)
  private loadFromStorage(): void {
    const data = this.storageService.getSessionAndUser();
    if (data) {
      this.session = data.session;
      this.user = data.user;
      this.userSubject.next(this.user); // Update the observable
    }
  }
}
