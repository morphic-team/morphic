import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-morphic-date',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <input 
      type="date"
      class="form-control"
      [class.extra]="cssClass"
      [ngClass]="ngClass"
      [id]="inputId"
      [name]="name"
      [disabled]="disabled"
      [(ngModel)]="internalValue"
      (ngModelChange)="onInternalChange()"
      (blur)="onTouched()">
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MorphicDateComponent),
      multi: true
    }
  ]
})
export class MorphicDateComponent implements ControlValueAccessor {
  @Input({ required: true }) inputId!: string;
  @Input({ required: true }) name!: string;
  @Input() disabled: boolean = false;
  @Input() cssClass?: string;
  @Input() ngClass?: any;

  // Internal value that HTML date input understands (YYYY-MM-DD format or empty string)
  internalValue: string = '';

  // ControlValueAccessor implementation
  private onChange: (value: string | null) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    // Convert null to empty string for HTML input
    // The value should already be in YYYY-MM-DD format if it exists
    this.internalValue = value ?? '';
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInternalChange(): void {
    // Convert empty string back to null for Morphic
    const morphicValue = this.internalValue === '' ? null : this.internalValue;
    this.onChange(morphicValue);
  }
}
