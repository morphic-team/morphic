import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export type ExtensionBrowser = 'chrome' | 'firefox' | 'unsupported';

export interface ExtensionStatus {
  isChecking: boolean;
  isInstalled: boolean;
  version: string;
  browser: ExtensionBrowser;
}

@Injectable({
  providedIn: 'root'
})
export class ExtensionService {
  readonly SUPPORTED_EXTENSION_VERSIONS = ['1.0.0', '1.0.1'];
  readonly RECOMMENDED_EXTENSION_VERSION = '1.0.0'; // Latest publicly available on CWS
  readonly PRODUCTION_EXTENSION_ID = 'fhigbmfhhlpkjbdamhjmfajhkfbkkgah';
  readonly CHROME_INSTALL_URL = 'https://chrome.google.com/webstore/detail/fhigbmfhhlpkjbdamhjmfajhkfbkkgah';

  // The Firefox handshake content script publishes the installed version as a data
  // attribute on <html>, because Firefox has no web-page-to-extension messaging.
  readonly FIREFOX_VERSION_ATTRIBUTE = 'morphicExtensionVersion';

  private readonly EXTENSION_CHECK_TIMEOUT_MS = 2000;

  checkExtensionStatus(): Observable<ExtensionStatus> {
    const browser = this.detectBrowser();

    switch (browser) {
      case 'chrome':
        return this.checkChromeExtension();
      case 'firefox':
        return this.checkFirefoxExtension();
      case 'unsupported':
        return this.completedStatus({ isInstalled: false, version: '', browser });
    }
  }

  detectBrowser(): ExtensionBrowser {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('firefox/')) {
      return 'firefox';
    }
    if (userAgent.includes('chrome') && !userAgent.includes('edg/')) {
      return 'chrome';
    }
    return 'unsupported';
  }

  isSupportedBrowser(): boolean {
    return this.detectBrowser() !== 'unsupported';
  }

  browserName(browser: ExtensionBrowser): string {
    switch (browser) {
      case 'chrome':
        return 'Chrome';
      case 'firefox':
        return 'Firefox';
      case 'unsupported':
        return 'Unsupported';
    }
  }

  // Null when the extension is not yet published for that browser
  installUrl(browser: ExtensionBrowser): string | null {
    return browser === 'chrome' ? this.CHROME_INSTALL_URL : null;
  }

  isVersionValid(version: string): boolean {
    return this.SUPPORTED_EXTENSION_VERSIONS.includes(version);
  }

  isExtensionValid(status: ExtensionStatus): boolean {
    return status.browser !== 'unsupported' && status.isInstalled && this.isVersionValid(status.version);
  }

  private checkFirefoxExtension(): Observable<ExtensionStatus> {
    const version = document.documentElement.dataset[this.FIREFOX_VERSION_ATTRIBUTE];
    return this.completedStatus({
      isInstalled: version !== undefined,
      version: version || '',
      browser: 'firefox'
    });
  }

  private checkChromeExtension(): Observable<ExtensionStatus> {
    const subject = new Subject<ExtensionStatus>();
    const browser: ExtensionBrowser = 'chrome';

    // Start checking
    subject.next({
      isChecking: true,
      isInstalled: false,
      version: '',
      browser
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      subject.next({
        isChecking: false,
        isInstalled: false,
        version: '',
        browser
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
              browser
            });
            subject.complete();
          }, 0);
        } else {
          // Extension responded successfully - emit immediately
          subject.next({
            isChecking: false,
            isInstalled: true,
            version: response.version || '',
            browser
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
          browser
        });
        subject.complete();
      }, 0);
    }

    return subject.asObservable();
  }

  private completedStatus(status: Omit<ExtensionStatus, 'isChecking'>): Observable<ExtensionStatus> {
    const subject = new Subject<ExtensionStatus>();
    // Emit asynchronously so subscribers attached after creation still receive the value
    setTimeout(() => {
      subject.next({ isChecking: false, ...status });
      subject.complete();
    }, 0);
    return subject.asObservable();
  }
}
