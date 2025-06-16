import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ChangelogEntry {
  text: string;
  isSubItem: boolean;
}

interface ChangelogVersion {
  version: string;
  date: string;
  sections: { [key: string]: ChangelogEntry[] };
}

interface Changelog {
  component: string;
  title: string;
  description: string;
  versions: ChangelogVersion[];
}

@Component({
  selector: 'app-changelog',
  imports: [CommonModule, FormsModule],
  templateUrl: './changelog.component.html',
  styleUrl: './changelog.component.css'
})
export class ChangelogComponent implements OnInit {
  changelog: Changelog | null = null;
  loading = true;
  error: string | null = null;
  showTechnicalDetails = false;
  selectedComponent = 'morphic';
  
  components = [
    { id: 'morphic', name: 'Main Project', description: 'Infrastructure & Deployment' },
    { id: 'service', name: 'Morphic Service', description: 'Morphic Cloud System' },
    { id: 'website', name: 'Website', description: 'Morphic Website' },
    { id: 'extension', name: 'Browser Extension', description: 'Morphic Browser Extension' }
  ];
  
  constructor(private http: HttpClient) {}
  
  ngOnInit(): void {
    this.loadChangelog();
  }
  
  loadChangelog(): void {
    const changelogFile = this.showTechnicalDetails ? `${this.selectedComponent}.json` : 'user.json';
    this.loading = true;
    
    this.http.get<Changelog>(`/changelogs/${changelogFile}`)
      .subscribe({
        next: (data) => {
          this.changelog = data;
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Failed to load changelog data';
          this.loading = false;
          console.error('Error loading changelog:', err);
        }
      });
  }
  
  toggleView(): void {
    if (this.showTechnicalDetails) {
      this.selectedComponent = 'morphic'; // Default to main project in technical mode
    }
    this.loadChangelog();
  }
  
  selectComponent(componentId: string): void {
    this.selectedComponent = componentId;
    this.loadChangelog();
  }
  
  getSelectedComponentName(): string {
    const component = this.components.find(c => c.id === this.selectedComponent);
    return component?.name || 'Technical';
  }
  
  getSectionKeys(sections: { [key: string]: ChangelogEntry[] }): string[] {
    return Object.keys(sections);
  }
  
  formatChangelogText(text: string): string {
    // Convert markdown-style bold (**text**) to HTML
    let formatted = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Convert backticks to code tags
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Convert markdown links [text](url) to HTML
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    return formatted;
  }
}