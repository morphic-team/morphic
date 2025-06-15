import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-search-result-form-controls',
  imports: [CommonModule],
  templateUrl: './search-result-form-controls.component.html',
  styleUrls: ['./search-result-form-controls.component.css']
})
export class SearchResultFormControlsComponent {
  @Input() hasUnsavedChanges: boolean = false;
  @Input() saving: boolean = false;
  @Input() hasNext: boolean = false;

  @Output() revertChanges = new EventEmitter<void>();
  @Output() saveForm = new EventEmitter<void>();
  @Output() saveAndNext = new EventEmitter<string>();

  // Internal hover state for this instance
  localHoverHint: string = '';

  onRevertChanges() {
    this.revertChanges.emit();
  }

  onSaveForm() {
    this.saveForm.emit();
  }

  onSaveAndNext(completionState: string) {
    this.saveAndNext.emit(completionState);
  }

  onHoverEnter(hint: string) {
    this.localHoverHint = hint;
  }

  onHoverLeave() {
    this.localHoverHint = '';
  }
}