import { Component, computed, inject, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import { PdfFormService } from './pdf-form.service';
import type { PdfField } from '../pdf/pdf-schema';

/** One PDF field rendered as a native control bound to its Signal Forms field. */
@Component({
  selector: 'pdf-field',
  imports: [FormField],
  host: { '[attr.data-field]': 'field().name', '[class.invalid]': 'error() !== null' },
  template: `
    @if (derived(); as value) {
      <input class="control computed" readonly [value]="value().toFixed(2)" [attr.aria-label]="field().name" />
    } @else {
      @switch (field().type) {
        @case ('checkbox') {
          <input type="checkbox" class="check" [formField]="checkbox()" [attr.aria-label]="field().name" />
        }
        @case ('select') {
          <select class="control" [formField]="text()" [attr.aria-label]="field().name">
            <option value=""></option>
            @for (o of field().options; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
          </select>
        }
        @default {
          <input class="control" [formField]="text()" [attr.aria-label]="field().name" />
        }
      }
      @if (error(); as message) { <div class="error">{{ message }}</div> }
    }
  `,
  styles: [`
    :host { display: block; }
    .control {
      width: 100%; height: 100%; box-sizing: border-box; border: none; outline: none;
      padding: 2px 6px; font: 14px Helvetica, Arial, sans-serif; color: #111;
      background: rgba(255, 245, 170, 0.75); transition: background 0.15s;
    }
    .control:focus { background: rgba(200, 220, 255, 0.9); outline: 2px solid #3a7bd5; outline-offset: -2px; }
    input.control:read-only { background: rgba(225, 235, 225, 0.9); font-weight: 600; cursor: default; }
    .check { width: 100%; height: 100%; margin: 0; accent-color: #3a7bd5; }
    :host(.invalid) .control, :host(.invalid) .check { background: rgba(255, 190, 190, 0.85); outline: 2px solid #d32f2f; outline-offset: -2px; }
    .error {
      position: absolute; top: 100%; left: 0; z-index: 10; white-space: nowrap;
      padding: 2px 6px; border-radius: 0 0 3px 3px; background: #d32f2f; color: #fff; font: 11px sans-serif;
    }
  `],
})
export class PdfFieldComponent {
  readonly field = input.required<PdfField>();
  private readonly pdfForm = inject(PdfFormService);

  protected readonly derived = computed(() => this.pdfForm.derived(this.field().name));
  private readonly tree = computed(() => this.pdfForm.field(this.field().name)!);
  protected readonly text = computed(() => this.tree() as FieldTree<string>);
  protected readonly checkbox = computed(() => this.tree() as FieldTree<boolean>);

  /** First error, shown once the user has touched the field. */
  protected readonly error = computed(() => {
    const state = this.tree()();
    return state.touched() ? state.errors()[0]?.message ?? null : null;
  });
}
