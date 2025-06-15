import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RequestsErrorHandler {
  specificallyHandled(action: () => void): void {
    try {
      action();
    } catch (error) {
      // Handle any specific global errors here
      console.error('Error handled:', error);
    }
  }
}