import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../services/user.service';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { RouterModule } from '@angular/router';


@Component({
    selector: 'app-navbar',
    imports: [CommonModule, RouterModule],
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  user$: Observable<any>; // Observable to track the user state

  constructor(private userService: UserService, private router: Router) {
    // Subscribe to user state
    this.user$ = this.userService.getUser();
  }

  // Sign out the user and navigate to the sign-in page
  signOut() {
    this.userService.signOut();
    this.router.navigate(['/sign-in']);
  }
}
