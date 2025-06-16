import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

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
  imports: [CommonModule],
  templateUrl: './changelog.component.html',
  styleUrl: './changelog.component.css'
})
export class ChangelogComponent implements OnInit {
  changelog: Changelog | null = null;
  loading = true;
  error: string | null = null;
  
  constructor(private http: HttpClient) {}
  
  ngOnInit(): void {
    this.loadChangelog();
  }
  
  loadChangelog(): void {
    this.http.get<Changelog>('/changelogs/morphic.json')
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