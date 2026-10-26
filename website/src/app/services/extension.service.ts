import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export type ExtensionBrowser = 'chrome' | 'edge' | 'firefox' | 'unsupported';

export interface ExtensionStatus {
  isChecking: boolean;
  isInstalled: boolean;
  version: string;
  browser: ExtensionBrowser;
}

// What the user is told about the extension:
// - none: a compatible extension is installed
// - unsupported: this browser cannot run the extension
// - updating: the store has no compatible build yet, the user has to wait for us
// - install: the store has a compatible build and the extension is not installed
// - pending: the store has a compatible build and the browser has not applied it yet
export type ExtensionNotice = 'none' | 'unsupported' | 'updating' | 'install' | 'pending';

export interface StoreListing {
  browser: Exclude<ExtensionBrowser, 'unsupported'>;
  name: string;
  url: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExtensionService {
  readonly SUPPORTED_EXTENSION_VERSIONS = ['1.1.0'];

  // Store listing per browser. Null while the store does not carry a build in
  // SUPPORTED_EXTENSION_VERSIONS, which puts that browser in the "updating" state.
  readonly STORE_URLS: Record<Exclude<ExtensionBrowser, 'unsupported'>, string | null> = {
    chrome: null,
    edge: null,
    firefox: 'https://addons.mozilla.org/firefox/addon/morphs-io-extension/'
  };

  // The extension's handshake content script runs on this site at document_start and
  // publishes the installed version as a data attribute on <html>.
  readonly VERSION_ATTRIBUTE = 'morphicExtensionVersion';

  checkExtensionStatus(): Observable<ExtensionStatus> {
    const browser = this.detectBrowser();
    if (browser === 'unsupported') {
      return this.completedStatus({ isInstalled: false, version: '', browser });
    }

    const version = document.documentElement.dataset[this.VERSION_ATTRIBUTE];
    return this.completedStatus({
      isInstalled: version !== undefined,
      version: version || '',
      browser
    });
  }

  detectBrowser(): ExtensionBrowser {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('firefox/')) {
      return 'firefox';
    }
    if (userAgent.includes('edg/')) {
      return 'edge';
    }
    if (userAgent.includes('chrome')) {
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
      case 'edge':
        return 'Edge';
      case 'firefox':
        return 'Firefox';
      case 'unsupported':
        return 'Unsupported';
    }
  }

  storeUrl(browser: ExtensionBrowser): string | null {
    return browser === 'unsupported' ? null : this.STORE_URLS[browser];
  }

  noticeFor(status: ExtensionStatus): ExtensionNotice {
    if (status.browser === 'unsupported') {
      return 'unsupported';
    }
    if (this.isExtensionValid(status)) {
      return 'none';
    }
    if (!this.storeUrl(status.browser)) {
      return 'updating';
    }
    return status.isInstalled ? 'pending' : 'install';
  }

  // Browsers whose store currently carries a compatible build.
  publishedStores(): StoreListing[] {
    return (Object.keys(this.STORE_URLS) as StoreListing['browser'][])
      .filter(browser => this.STORE_URLS[browser] !== null)
      .map(browser => ({ browser, name: this.browserName(browser), url: this.STORE_URLS[browser]! }));
  }

  isVersionValid(version: string): boolean {
    return this.SUPPORTED_EXTENSION_VERSIONS.includes(version);
  }

  isExtensionValid(status: ExtensionStatus): boolean {
    return status.browser !== 'unsupported' && status.isInstalled && this.isVersionValid(status.version);
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
