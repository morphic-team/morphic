import { Component, Input } from '@angular/core';
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
  selector: 'app-survey-preview',
  imports: [CommonModule, FormsModule, LocationPickerComponent, MorphicTextComponent, MorphicSelectComponent, MorphicRadioComponent, MorphicDateComponent],
  templateUrl: './survey-preview.component.html',
  styleUrls: ['./survey-preview.component.css']
})
export class SurveyPreviewComponent {
  @Input() survey: Survey = {
    name: '',
    comments: '',
    fields: [],
    isMutable: true
  };

  // Mock form values for preview
  previewValues: { [fieldId: string]: any } = {};

  constructor() {}

  getOptionsArray(field: SurveyField): string[] {
    if (!field.options) return [];
    if (Array.isArray(field.options)) {
      return field.options;
    }
    return field.options.split(',').map(option => option.trim()).filter(option => option.length > 0);
  }
}