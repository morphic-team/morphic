import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Survey, SurveyField, FIELD_TYPES, FieldType } from '../models/survey.model';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-survey-builder',
  imports: [CommonModule, FormsModule],
  templateUrl: './survey-builder.component.html',
  styleUrls: ['./survey-builder.component.css']
})
export class SurveyBuilderComponent {
  @Input() survey: Survey = {
    name: '',
    comments: '',
    fields: [],
    isMutable: true
  };
  
  @Output() surveyChange = new EventEmitter<Survey>();

  fieldTypes = FIELD_TYPES;
  
  // Add field form
  addFieldForm = {
    label: '',
    fieldType: this.fieldTypes[0],
    options: ''
  };

  showAddFieldForm = false;

  constructor(private storageService: StorageService) {}

  get shouldShowWarning(): boolean {
    const preferences = this.storageService.getUserPreferences();
    return !preferences.dismissedSurveyBuilderWarning;
  }

  dismissWarning(): void {
    this.storageService.updateUserPreference('dismissedSurveyBuilderWarning', true);
  }

  onSurveyChange() {
    this.surveyChange.emit(this.survey);
  }

  addField() {
    if (!this.addFieldForm.label.trim()) {
      return;
    }

    const newField: SurveyField = {
      id: this.generateFieldId(),
      label: this.addFieldForm.label.trim(),
      fieldType: this.addFieldForm.fieldType.id,
      order: this.survey.fields.length + 1
    };

    // Add options for select/radio fields
    if (this.addFieldForm.fieldType.id === 'select' || this.addFieldForm.fieldType.id === 'radio') {
      newField.options = this.addFieldForm.options.trim();
    }

    this.survey.fields.push(newField);
    this.resetAddFieldForm();
    this.onSurveyChange();
  }

  removeField(index: number) {
    this.survey.fields.splice(index, 1);
    this.onSurveyChange();
  }

  moveFieldUp(index: number) {
    if (index > 0) {
      [this.survey.fields[index], this.survey.fields[index - 1]] = 
      [this.survey.fields[index - 1], this.survey.fields[index]];
      this.onSurveyChange();
    }
  }

  moveFieldDown(index: number) {
    if (index < this.survey.fields.length - 1) {
      [this.survey.fields[index], this.survey.fields[index + 1]] = 
      [this.survey.fields[index + 1], this.survey.fields[index]];
      this.onSurveyChange();
    }
  }

  toggleAddFieldForm() {
    this.showAddFieldForm = !this.showAddFieldForm;
    if (!this.showAddFieldForm) {
      this.resetAddFieldForm();
    }
  }

  private resetAddFieldForm() {
    this.addFieldForm = {
      label: '',
      fieldType: this.fieldTypes[0],
      options: ''
    };
  }

  getFieldTypeLabel(fieldType: string): string {
    switch (fieldType) {
      case 'text': return 'Text';
      case 'select': return 'Select';
      case 'radio': return 'Radio';
      case 'location': return 'Location';
      default: return fieldType;
    }
  }

  private generateFieldId(): string {
    return 'field_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  requiresOptions(fieldType: FieldType): boolean {
    return fieldType.id === 'select' || fieldType.id === 'radio';
  }
}