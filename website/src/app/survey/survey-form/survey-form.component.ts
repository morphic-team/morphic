import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Survey, SurveyField } from '../models/survey.model';
import { LocationPickerComponent } from '../location-picker/location-picker.component';
import { LocationData } from '../models/location.model';
import { MorphicTextComponent } from '../form-fields/morphic-text.component';
import { MorphicSelectComponent } from '../form-fields/morphic-select.component';
import { MorphicRadioComponent } from '../form-fields/morphic-radio.component';
import { MorphicDateComponent } from '../morphic-date/morphic-date.component';

@Component({
  selector: 'app-survey-form',
  imports: [CommonModule, FormsModule, LocationPickerComponent, MorphicTextComponent, MorphicSelectComponent, MorphicRadioComponent, MorphicDateComponent],
  templateUrl: './survey-form.component.html',
  styleUrls: ['./survey-form.component.css']
})
export class SurveyFormComponent implements OnInit {
  @Input() survey: Survey = {
    name: '',
    comments: '',
    fields: [],
    isMutable: true
  };

  @Input() initialValues: { [fieldId: string]: any } = {};
  @Input() disabled: boolean = false;
  @Input() showSubmitButton: boolean = true;
  @Input() submitButtonText: string = 'Submit';
  @Input() changedFields: Set<string> = new Set();

  @Output() formSubmit = new EventEmitter<{ [fieldId: string]: any }>();
  @Output() formChange = new EventEmitter<{ [fieldId: string]: any }>();
  @Output() fieldChange = new EventEmitter<{ fieldId: string, value: any, allValues: { [fieldId: string]: any } }>();

  formValues: { [fieldId: string]: any } = {};

  constructor() {}

  ngOnInit() {
    // Initialize form values with initial values
    this.formValues = { ...this.initialValues };
  }

  getSortedFields(): SurveyField[] {
    return [...this.survey.fields].sort((a, b) => a.order - b.order);
  }

  onFormValueChange() {
    this.formChange.emit({ ...this.formValues });
  }

  onFieldValueChange(field: SurveyField, value: any) {
    const fieldId = this.getFieldKey(field);
    this.formValues[fieldId] = value;
    this.fieldChange.emit({ 
      fieldId, 
      value, 
      allValues: { ...this.formValues } 
    });
    this.onFormValueChange();
  }

  onSubmit() {
    this.formSubmit.emit({ ...this.formValues });
  }

  isFieldChanged(field: SurveyField): boolean {
    const fieldId = this.getFieldKey(field);
    return this.changedFields.has(fieldId);
  }

  resetForm() {
    // Reset form values back to initial values
    this.formValues = { ...this.initialValues };
    this.onFormValueChange();
  }

  getOptionsArray(field: SurveyField): string[] {
    if (!field.options) return [];
    if (Array.isArray(field.options)) {
      return field.options;
    }
    return field.options.split(',').map((option: string) => option.trim()).filter((option: string) => option.length > 0);
  }

  getFieldKey(field: any): string {
    // Use field ID as the key for stable references
    return field.id.toString();
  }

  isFormValid(): boolean {
    return true;
  }
}