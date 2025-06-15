import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SearchesService, Search } from '../services/searches.service';
import { StorageService } from '../../services/storage.service';
import { ExtensionService, ExtensionStatus } from '../../services/extension.service';
import { GatherResultsModalComponent } from '../gather-results-modal/gather-results-modal.component';

@Component({
    selector: 'app-searches-list',
    imports: [CommonModule, RouterModule, GatherResultsModalComponent],
    templateUrl: './searches-list.component.html',
    styleUrl: './searches-list.component.css'
})
export class SearchesListComponent implements OnInit {
  @ViewChild('gatherModal') gatherModal!: GatherResultsModalComponent;
  
  searches: Search[] = [];
  surveyId: string | null = null;
  showExtensionNotice = false;
  extensionStatus: ExtensionStatus = {
    isChecking: false,
    isInstalled: false,
    version: '',
    isChromeBrowser: false
  };
  isRefreshing = false;

  constructor(
    private route: ActivatedRoute,
    private searchesService: SearchesService,
    private storageService: StorageService,
    private extensionService: ExtensionService
  ) {}

  ngOnInit(): void {
    this.surveyId = this.route.parent?.snapshot.paramMap.get('id') || null;
    if (this.surveyId) {
      this.fetchSearches();
    }
    
    // Check extension status
    this.checkExtensionVersion();
  }

  fetchSearches(): void {
    if (this.surveyId) {
      this.searchesService.getSearches(this.surveyId)
        .subscribe({
          next: (response) => {
            this.searches = response.results;
            this.isRefreshing = false;
          },
          error: (error) => {
            console.error('Error fetching searches:', error);
            this.isRefreshing = false;
          }
        });
    }
  }

  runSearch(search: Search): void {
    this.gatherModal.show(search);
  }

  refreshSearches(): void {
    this.isRefreshing = true;
    this.fetchSearches();
  }

  private checkExtensionVersion() {
    this.extensionService.checkExtensionStatus().subscribe(status => {
      this.extensionStatus = status;
      
      // Update extension status and check if notice should show
      this.storageService.updateExtensionStatus(status.version || null, status.isInstalled);
      this.showExtensionNotice = this.storageService.shouldShowExtensionNotice(status.version || null, status.isInstalled) && status.isChromeBrowser;
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

  dismissExtensionNotice(): void {
    this.showExtensionNotice = false;
    this.storageService.dismissExtensionNotice(this.extensionStatus.version || null, this.extensionStatus.isInstalled);
  }
}
