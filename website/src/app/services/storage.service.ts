import { Injectable } from '@angular/core';

/**
 * Storage Migration Service
 * 
 * Provides versioned localStorage with automatic migrations and error recovery.
 * 
 * Algorithm:
 * 1. runMigrationsSync() - Compares stored version vs current version
 *    - No stored version? Treat as version 0 (legacy data)
 *    - Same version? Continue normally
 *    - Stored > current? Clear storage (downgrade scenario)
 *    - Stored < current? Proceed to step 2
 * 
 * 2. performMigrations() - Orchestrates migration process
 *    - Find applicable migrations (version > stored version)
 *    - No migrations defined? Clear storage (dev convenience)
 *    - Has migrations? Apply each in order (step 3)
 * 
 * 3. applyMigration() - Executes individual migration
 *    - Load all localStorage data
 *    - Pass to migration.migrate() function
 *    - Clear storage and restore with migrated data
 * 
 * Error Handling:
 * - Any error at any level clears storage and continues
 * - Ensures app never gets stuck in broken state
 * - Users just need to sign in again if migration fails
 * 
 * Usage:
 * - Add new migrations to migrations array with incremented version
 * - Migrations run automatically on service construction
 * - Use getSessionAndUser(), setSessionAndUser() etc. for typed access
 */

export interface SessionData {
  // Add proper typing based on what your backend returns
  [key: string]: any;
}

export interface UserData {
  id: number;
  emailAddress: string;
  // Add other user properties as needed
  [key: string]: any;
}

export interface SessionAndUser {
  session: SessionData | null;
  user: UserData | null;
}

export interface UserPreferences {
  dismissedExtensionNotice?: boolean;
  dismissedExtensionVersion?: string; // Track which version was dismissed
  lastSeenExtensionStatus?: 'missing' | 'installed'; // Track extension state changes
  dismissedSurveyBuilderWarning?: boolean; // Track if user has dismissed the immutable survey warning
  // Add other preferences here as needed
}

export interface StorageMigration {
  version: number;
  migrate: (data: { [key: string]: any }) => { [key: string]: any };
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly STORAGE_VERSION_KEY = 'morphic_storage_version';
  private readonly SESSION_AND_USER_KEY = 'session_and_user';
  private readonly USER_PREFERENCES_KEY = 'user_preferences';
  private readonly CURRENT_VERSION = 3;
  
  private get migrations(): StorageMigration[] {
    return [
      {
        version: 1,
        migrate: (data) => {
          // Transform snake_case to camelCase for existing session_and_user data
          if (data['session_and_user'] && typeof data['session_and_user'] === 'object') {
            data['session_and_user'] = {
              session: data['session_and_user']['session'],
              user: this.transformToCamelCase(data['session_and_user']['user'])
            };
          }
          return data;
        }
      },
      {
        version: 2,
        migrate: (data) => {
          // Initialize user preferences if not present
          if (!data['user_preferences']) {
            data['user_preferences'] = {};
          }
          return data;
        }
      },
      {
        version: 3,
        migrate: (data) => {
          // Reset extension dismissal state since we're adding version tracking
          if (data['user_preferences'] && typeof data['user_preferences'] === 'object') {
            // Remove old dismissal to ensure users see new extension version checking
            delete data['user_preferences']['dismissedExtensionNotice'];
            // Initialize new fields
            data['user_preferences']['dismissedExtensionVersion'] = undefined;
            data['user_preferences']['lastSeenExtensionStatus'] = undefined;
          }
          return data;
        }
      }
    ];
  }

  private migrationComplete = false;

  constructor() {
    try {
      this.runMigrationsSync();
    } catch (error) {
      console.error('Storage migration failed, clearing all storage:', error);
      this.clearAllStorage();
      this.migrationComplete = true;
    }
  }

  private runMigrationsSync(): void {
    const storedVersion = this.getStoredVersion() ?? 0; // Treat no version as version 0
    
    if (storedVersion === this.CURRENT_VERSION) {
      // Up to date
      this.migrationComplete = true;
      return;
    }

    if (storedVersion > this.CURRENT_VERSION) {
      // Future version - clear storage (downgrade scenario)
      console.warn(`Storage version ${storedVersion} is newer than current ${this.CURRENT_VERSION}. Clearing storage.`);
      this.clearAllStorage();
      this.migrationComplete = true;
      return;
    }

    // Need to migrate from storedVersion to CURRENT_VERSION
    this.performMigrations(storedVersion);
    this.migrationComplete = true;
  }

  private performMigrations(fromVersion: number): void {
    const applicableMigrations = this.migrations.filter(m => m.version > fromVersion);
    
    if (applicableMigrations.length === 0) {
      // No migrations defined - clear storage for dev convenience
      console.warn(`No migrations defined from version ${fromVersion} to ${this.CURRENT_VERSION}. Clearing storage.`);
      this.clearAllStorage();
      return;
    }

    // Apply migrations in order
    for (const migration of applicableMigrations.sort((a, b) => a.version - b.version)) {
      console.log(`Applying storage migration to version ${migration.version}`);
      try {
        this.applyMigration(migration);
      } catch (error) {
        console.error(`Migration to version ${migration.version} failed:`, error);
        throw error; // Re-throw to trigger top-level catch
      }
    }

    this.setStoredVersion(this.CURRENT_VERSION);
  }

  private applyMigration(migration: StorageMigration): void {
    // Get all localStorage data
    const allData: { [key: string]: any } = {};
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key !== this.STORAGE_VERSION_KEY) {
        try {
          allData[key] = JSON.parse(localStorage.getItem(key) || 'null');
        } catch {
          // Keep as string if not JSON
          allData[key] = localStorage.getItem(key);
        }
      }
    }

    // Apply migration
    const migratedData = migration.migrate(allData);

    // Clear and restore migrated data
    this.clearAllStorage();
    for (const [key, value] of Object.entries(migratedData)) {
      if (value !== null && value !== undefined) {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    }
  }

  private clearAllStorage(): void {
    localStorage.clear();
    this.setStoredVersion(this.CURRENT_VERSION);
  }

  private getStoredVersion(): number | null {
    const version = localStorage.getItem(this.STORAGE_VERSION_KEY);
    return version ? parseInt(version, 10) : null;
  }

  private setStoredVersion(version: number): void {
    localStorage.setItem(this.STORAGE_VERSION_KEY, version.toString());
  }

  private ensureMigrationComplete(): void {
    if (!this.migrationComplete) {
      throw new Error('Storage migrations not yet complete');
    }
  }

  // Public API for application use
  getSessionAndUser(): SessionAndUser | null {
    this.ensureMigrationComplete();
    const stored = localStorage.getItem(this.SESSION_AND_USER_KEY);
    if (!stored) {
      return null;
    }
    
    try {
      const parsed = JSON.parse(stored);
      return {
        session: parsed.session || null,
        user: parsed.user || null
      };
    } catch {
      return null;
    }
  }

  setSessionAndUser(sessionAndUser: SessionAndUser): void {
    this.ensureMigrationComplete();
    localStorage.setItem(this.SESSION_AND_USER_KEY, JSON.stringify(sessionAndUser));
  }

  clearSessionAndUser(): void {
    this.ensureMigrationComplete();
    localStorage.removeItem(this.SESSION_AND_USER_KEY);
  }

  // Convenience methods
  getUser(): UserData | null {
    const data = this.getSessionAndUser();
    return data?.user || null;
  }

  getSession(): SessionData | null {
    const data = this.getSessionAndUser();
    return data?.session || null;
  }

  // User preferences methods
  getUserPreferences(): UserPreferences {
    this.ensureMigrationComplete();
    const stored = localStorage.getItem(this.USER_PREFERENCES_KEY);
    if (!stored) {
      return {};
    }
    
    try {
      return JSON.parse(stored);
    } catch {
      return {};
    }
  }

  setUserPreferences(preferences: UserPreferences): void {
    this.ensureMigrationComplete();
    localStorage.setItem(this.USER_PREFERENCES_KEY, JSON.stringify(preferences));
  }

  updateUserPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    const preferences = this.getUserPreferences();
    preferences[key] = value;
    this.setUserPreferences(preferences);
  }

  // Extension dismissal logic with smart reset
  shouldShowExtensionNotice(currentVersion: string | null, extensionInstalled: boolean): boolean {
    const preferences = this.getUserPreferences();
    const currentStatus = extensionInstalled ? 'installed' : 'missing';
    
    // Reset dismissal if extension status changed
    if (preferences.lastSeenExtensionStatus && preferences.lastSeenExtensionStatus !== currentStatus) {
      this.resetExtensionDismissal();
      return true;
    }
    
    // Reset dismissal if extension version changed
    if (extensionInstalled && preferences.dismissedExtensionVersion && preferences.dismissedExtensionVersion !== currentVersion) {
      this.resetExtensionDismissal();
      return true;
    }
    
    // Show notice if not dismissed or if problem exists
    return !preferences.dismissedExtensionNotice;
  }

  dismissExtensionNotice(currentVersion: string | null, extensionInstalled: boolean): void {
    const preferences = this.getUserPreferences();
    preferences.dismissedExtensionNotice = true;
    preferences.dismissedExtensionVersion = currentVersion || undefined;
    preferences.lastSeenExtensionStatus = extensionInstalled ? 'installed' : 'missing';
    this.setUserPreferences(preferences);
  }

  updateExtensionStatus(currentVersion: string | null, extensionInstalled: boolean): void {
    // Update last seen status without dismissing - used to track state changes
    const preferences = this.getUserPreferences();
    const currentStatus = extensionInstalled ? 'installed' : 'missing';
    
    // Only update if status actually changed
    if (preferences.lastSeenExtensionStatus !== currentStatus) {
      preferences.lastSeenExtensionStatus = currentStatus;
      this.setUserPreferences(preferences);
    }
  }

  private resetExtensionDismissal(): void {
    const preferences = this.getUserPreferences();
    preferences.dismissedExtensionNotice = false;
    preferences.dismissedExtensionVersion = undefined;
    this.setUserPreferences(preferences);
  }

  // Utility method for migrations
  private transformToCamelCase(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.transformToCamelCase(item));
    if (typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const camelKey = key === 'id_' ? 'id' : key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          newObj[camelKey] = this.transformToCamelCase(obj[key]);
        }
      }
      return newObj;
    }
    return obj;
  }
}