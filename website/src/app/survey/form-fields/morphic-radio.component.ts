import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-morphic-radio',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mb-3">
      <div *ngFor="let option of options; let i = index" class="form-check">
        <input 
          type="radio" 
          class="form-check-input" 
          [class.extra]="cssClass"
          [ngClass]="ngClass"
          [id]="inputId + '_' + i"
          [name]="name"
          [value]="option"
          [disabled]="disabled"
          [(ngModel)]="internalValue"
          (ngModelChange)="onInternalChange()"
          (blur)="onTouched()">
        <label class="form-check-label" [for]="inputId + '_' + i">
          {{ option }}
        </label>
      </div>
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MorphicRadioComponent),
      multi: true
    }
  ]
})
export class MorphicRadioComponent implements ControlValueAccessor {
  @Input({ required: true }) options!: string[];
  @Input({ required: true }) inputId!: string;
  @Input({ required: true }) name!: string;
  @Input() disabled: boolean = false;
  @Input() cssClass?: string;
  @Input() ngClass?: any;

  // Internal value that HTML understands (undefined/string for radio selection)
  internalValue: string | undefined = undefined;

  // ControlValueAccessor implementation
  private onChange: (value: string | null) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    // Convert null to undefined for HTML radio buttons (no selection)
    this.internalValue = value ?? undefined;
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
    // Convert undefined back to null for Morphic
    const morphicValue = this.internalValue ?? null;
    this.onChange(morphicValue);
  }
}