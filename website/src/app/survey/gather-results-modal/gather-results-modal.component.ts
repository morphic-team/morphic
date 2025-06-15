import { Component, ElementRef, ViewChild, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchesService, Search } from '../services/searches.service';
import { ExtensionService, ExtensionStatus } from '../../services/extension.service';

declare var bootstrap: any;

@Component({
  selector: 'app-gather-results-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gather-results-modal.component.html',
  styleUrl: './gather-results-modal.component.css'
})
export class GatherResultsModalComponent {
  @ViewChild('modal') modalElement!: ElementRef;
  @Input() search: Search | null = null;
  
  private readonly DEFAULT_RESULT_LIMIT = 100;
  private readonly MIN_RESULT_LIMIT = 1;
  private readonly MAX_RESULT_LIMIT = 400;
  private readonly URL_GENERATION_DEBOUNCE_MS = 500;
  
  resultLimit: number = this.DEFAULT_RESULT_LIMIT;
  isGenerating: boolean = false;
  error: string = '';
  extensionStatus: ExtensionStatus = {
    isChecking: false,
    isInstalled: false,
    version: '',
    isChromeBrowser: false
  };
  googleSearchUrl: string = '';
  
  private modalInstance: any;
  private debounceTimer: any;

  constructor(
    private searchesService: SearchesService,
    private extensionService: ExtensionService
  ) {}

  ngAfterViewInit() {
    this.modalInstance = new bootstrap.Modal(this.modalElement.nativeElement);
  }

  show(search: Search) {
    this.search = search;
    this.error = '';
    this.resultLimit = this.DEFAULT_RESULT_LIMIT;
    this.googleSearchUrl = '';
    this.modalInstance.show();
    
    // Check extension when modal opens
    this.checkExtensionVersion();
    
    // Defer URL generation to avoid change detection errors
    setTimeout(() => {
      this.generateUrl();
    }, 0);
  }

  hide() {
    this.modalInstance.hide();
  }

  onStartGathering() {
    // Validate before proceeding
    if (!this.validateLimit()) {
      return false; // Prevent navigation if validation fails
    }
    
    // Force immediate URL generation if needed
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    if (!this.googleSearchUrl || this.isGenerating) {
      this.generateUrl();
      return false; // Prevent link navigation until URL is ready
    }
    
    this.hide();
    return true; // Allow link navigation
  }
  
  onLimitChange() {
    // Validate the limit
    if (!this.validateLimit()) {
      return;
    }
    
    // Debounce URL generation to avoid too many API calls
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.generateUrl();
    }, this.URL_GENERATION_DEBOUNCE_MS);
  }

  private validateLimit(): boolean {
    this.error = '';
    
    if (!this.resultLimit || isNaN(this.resultLimit)) {
      this.error = 'Please enter a valid number.';
      return false;
    }
    
    if (this.resultLimit < this.MIN_RESULT_LIMIT) {
      this.error = `Number of results must be at least ${this.MIN_RESULT_LIMIT}.`;
      return false;
    }
    
    if (this.resultLimit > this.MAX_RESULT_LIMIT) {
      this.error = `Number of results cannot exceed ${this.MAX_RESULT_LIMIT}.`;
      return false;
    }
    
    return true;
  }

  private checkExtensionVersion() {
    this.extensionService.checkExtensionStatus().subscribe(status => {
      this.extensionStatus = status;
    });
  }
  
  get isExtensionVersionValid(): boolean {
    return this.extensionService.isExtensionValid(this.extensionStatus);
  }
  
  get isExtensionOutdated(): boolean {
    return this.extensionStatus.isInstalled && !this.extensionService.isVersionValid(this.extensionStatus.version);
  }
  
  get REQUIRED_EXTENSION_VERSION(): string {
    return this.extensionService.RECOMMENDED_EXTENSION_VERSION;
  }

  isChromeBrowser(): boolean {
    return this.extensionService.isChromeBrowser();
  }

  private generateUrl() {
    if (!this.search || !this.validateLimit()) {
      return;
    }

    this.isGenerating = true;
    this.error = '';
    this.googleSearchUrl = '';

    this.searchesService.generateUploadUrl(this.search.id, this.resultLimit).subscribe({
      next: (response) => {
        this.googleSearchUrl = response.googleSearchUrl;  // camelCase!
        this.isGenerating = false;
      },
      error: (error) => {
        console.error('Error generating upload URL:', error);
        this.error = 'Failed to generate search URL. Please try again.';
        this.isGenerating = false;
      }
    });
  }
}