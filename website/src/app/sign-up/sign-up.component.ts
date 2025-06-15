import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-sign-up',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.css']
})
export class SignUpComponent {
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';
  isSubmitting = false;

  constructor(private userService: UserService, private router: Router) {}

  signUp() {
    this.errorMessage = '';
    
    // Basic validation
    if (!this.email || !this.password || !this.confirmPassword) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.errorMessage = 'Please enter a valid email address.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long.';
      return;
    }

    this.isSubmitting = true;
    this.userService.signUp(this.email, this.password).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.router.navigate(['/surveys']);  // Redirect after successful sign-up
      },
      error: (err) => {
        this.isSubmitting = false;
        // Extract error message from response
        if (err.error && err.error.error) {
          this.errorMessage = err.error.error;
        } else if (err.status === 409) {
          this.errorMessage = 'An account with this email address already exists';
        } else if (err.status === 400) {
          this.errorMessage = 'Please check your input and try again';
        } else {
          this.errorMessage = 'Sign up failed. Please try again.';
        }
      }
    });
  }
}