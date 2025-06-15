export interface Survey {
  id?: number;
  name: string;
  comments: string;
  fields: SurveyField[];
  isMutable: boolean;
}

export interface SurveyField {
  id: string;
  label: string;
  fieldType: 'text' | 'select' | 'radio' | 'location';
  options?: string | string[]; // comma-separated string during creation, array when loaded from backend
  order: number;
}

export interface FieldType {
  id: 'text' | 'select' | 'radio' | 'location';
  label: string;
}

export const FIELD_TYPES: FieldType[] = [
  { id: 'text', label: 'Text' },
  { id: 'select', label: 'Select' },
  { id: 'radio', label: 'Radio' },
  { id: 'location', label: 'Location' }
];