import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StorageService } from './services/storage.service';

@Injectable()
export class MorphicInterceptor implements HttpInterceptor {
  constructor(private storageService: StorageService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Transform request body from camelCase to snake_case
    let transformedReq = req;
    if (req.body && typeof req.body === 'object') {
      const transformedBody = this.transformRequestBody(req.body);
      transformedReq = req.clone({
        body: transformedBody
      });
    }

    // Add session authentication header if available
    const session = this.storageService.getSession();
    if (session && session['token']) {
      transformedReq = transformedReq.clone({
        setHeaders: {
          'X-Session-Token': session['token']
        }
      });
    }

    return next.handle(transformedReq).pipe(
      map(event => {
        if (event instanceof HttpResponse) {
          // Skip transformation for blob responses (file downloads)
          if (event.body instanceof Blob) {
            return event;
          }
          
          // Transform response data to match frontend conventions
          if (event.body) {
            const transformedBody = this.transformApiResponse(event.body);
            return event.clone({
              body: transformedBody
            });
          }
        }
        return event;
      })
    );
  }

  private transformApiResponse(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.transformApiResponse(item));
    } else if (obj !== null && typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const transformedKey = this.transformKey(key);
          // Recursively transform nested objects/arrays
          newObj[transformedKey] = this.transformApiResponse(obj[key]);
        }
      }
      return newObj;
    }
    return obj;
  }

  private transformKey(key: string): string {
    // Handle specific ID field transformation
    if (key === 'id_') {
      return 'id';
    }
    
    // Convert snake_case to camelCase
    return this.toCamelCase(key);
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  private transformRequestBody(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.transformRequestBody(item));
    } else if (obj !== null && typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const transformedKey = this.toSnakeCase(key);
          // Recursively transform nested objects/arrays
          newObj[transformedKey] = this.transformRequestBody(obj[key]);
        }
      }
      return newObj;
    }
    return obj;
  }

  private toSnakeCase(str: string): string {
    // Handle special case: id should become id_ for backend
    if (str === 'id') {
      return 'id_';
    }
    
    // Convert camelCase to snake_case
    return str.replace(/([A-Z])/g, (match, letter) => '_' + letter.toLowerCase());
  }
}