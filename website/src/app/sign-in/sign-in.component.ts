import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserService } from '../services/user.service';

@Component({
    selector: 'app-sign-in', // Standalone component
    imports: [CommonModule, FormsModule, RouterModule], // Add RouterModule for routerLink
    templateUrl: './sign-in.component.html',
    styleUrls: ['./sign-in.component.css']
})
export class SignInComponent {
  email = '';
  password = '';
  errorMessage = '';
  isSubmitting = false;

  constructor(private userService: UserService, private router: Router) {}

  signIn() {
    this.errorMessage = '';
    
    // Basic validation
    if (!this.email || !this.password) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.errorMessage = 'Please enter a valid email address.';
      return;
    }

    this.isSubmitting = true;
    
    this.userService.signIn(this.email, this.password).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.router.navigate(['/surveys']);  // Redirect after successful sign-in
      },
      error: (err) => {
        this.isSubmitting = false;
        // Extract error message from response
        if (err.error && err.error.error) {
          this.errorMessage = err.error.error;
        } else if (err.status === 401) {
          this.errorMessage = 'Invalid email or password';
        } else if (err.status === 400) {
          this.errorMessage = 'Please enter both email and password';
        } else {
          this.errorMessage = 'Sign in failed. Please try again.';
        }
      }
    });
  }
}