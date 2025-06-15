import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { UserService } from './services/user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private userService: UserService, private router: Router) {}

  canActivate(): boolean {
    if (this.userService.isSignedIn()) {
      return true;  // User is signed in, allow access to the route
    } else {
      this.router.navigate(['/sign-in']);  // User is not signed in, redirect to sign-in page
      return false;  // Block access to the route
    }
  }
}