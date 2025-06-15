import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-morphic-select',
  imports: [CommonModule, FormsModule],
  template: `
    <select 
      class="form-control"
      [class.extra]="cssClass"
      [ngClass]="ngClass"
      [id]="inputId"
      [name]="name"
      [disabled]="disabled"
      [(ngModel)]="internalValue"
      (ngModelChange)="onInternalChange()"
      (blur)="onTouched()">
      <option value="">{{ placeholder }}</option>
      <option *ngFor="let option of options" [value]="option">
        {{ option }}
      </option>
    </select>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MorphicSelectComponent),
      multi: true
    }
  ]
})
export class MorphicSelectComponent implements ControlValueAccessor {
  @Input({ required: true }) options!: string[];
  @Input() placeholder: string = '-- Select an option --';
  @Input({ required: true }) inputId!: string;
  @Input({ required: true }) name!: string;
  @Input() disabled: boolean = false;
  @Input() cssClass?: string;
  @Input() ngClass?: any;

  // Internal value that HTML understands (empty string for nothing selected)
  internalValue: string = '';

  // ControlValueAccessor implementation
  private onChange: (value: string | null) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    // Convert null to empty string for HTML select
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