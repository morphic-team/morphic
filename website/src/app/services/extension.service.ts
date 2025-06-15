import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface ExtensionStatus {
  isChecking: boolean;
  isInstalled: boolean;
  version: string;
  isChromeBrowser: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ExtensionService {
  readonly SUPPORTED_EXTENSION_VERSIONS = ['1.0.0', '1.0.1'];
  readonly RECOMMENDED_EXTENSION_VERSION = '1.0.0'; // Latest publicly available on CWS
  readonly PRODUCTION_EXTENSION_ID = 'fhigbmfhhlpkjbdamhjmfajhkfbkkgah';
  
  private readonly EXTENSION_CHECK_TIMEOUT_MS = 2000;

  checkExtensionStatus(): Observable<ExtensionStatus> {
    const subject = new Subject<ExtensionStatus>();
    
    
    // Check if Chrome browser
    if (!this.isChromeBrowser()) {
      subject.next({
        isChecking: false,
        isInstalled: false,
        version: '',
        isChromeBrowser: false
      });
      subject.complete();
      return subject.asObservable();
    }

    // Start checking
    subject.next({
      isChecking: true,
      isInstalled: false,
      version: '',
      isChromeBrowser: true
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      subject.next({
        isChecking: false,
        isInstalled: false,
        version: '',
        isChromeBrowser: true
      });
      subject.complete();
    }, this.EXTENSION_CHECK_TIMEOUT_MS);

    // Try to communicate with extension
    if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
      (window as any).chrome.runtime.sendMessage(this.PRODUCTION_EXTENSION_ID, { action: 'getVersion' }, (response: any) => {
        clearTimeout(timeoutId);
        
        if ((window as any).chrome.runtime.lastError || !response) {
          // Extension failed to respond - use setTimeout for timing fix
          setTimeout(() => {
            subject.next({
              isChecking: false,
              isInstalled: false,
              version: '',
              isChromeBrowser: true
            });
            subject.complete();
          }, 0);
        } else {
          // Extension responded successfully - emit immediately
          subject.next({
            isChecking: false,
            isInstalled: true,
            version: response.version || '',
            isChromeBrowser: true
          });
          subject.complete();
        }
      });
    } else {
      // No Chrome runtime available - use setTimeout for timing fix
      clearTimeout(timeoutId);
      setTimeout(() => {
        subject.next({
          isChecking: false,
          isInstalled: false,
          version: '',
          isChromeBrowser: true
        });
        subject.complete();
      }, 0);
    }

    return subject.asObservable();
  }

  isChromeBrowser(): boolean {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return userAgent.includes('chrome') && !userAgent.includes('edg/'); // Chrome but not Edge
  }

  isVersionValid(version: string): boolean {
    return this.SUPPORTED_EXTENSION_VERSIONS.includes(version);
  }

  isExtensionValid(status: ExtensionStatus): boolean {
    return status.isChromeBrowser && status.isInstalled && this.isVersionValid(status.version);
  }
}