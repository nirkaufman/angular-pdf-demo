import { Component, inject, signal } from '@angular/core';
import { PdfViewerComponent } from './pdf/pdf-viewer.component';
import { PdfFormService } from './form/pdf-form.service';
import { invoiceRules } from './form/invoice.rules';

@Component({
  selector: 'app-root',
  imports: [PdfViewerComponent],
  host: {
    '(dragover)': '$event.preventDefault(); dropping.set(true)',
    '(dragleave)': 'dropping.set(false)',
    '(drop)': 'onDrop($event)',
    '[class.dropping]': 'dropping()',
  },
  template: `
    <header>
      <h1>Angular inside a PDF <span class="file">{{ pdfForm.document()?.name }}</span></h1>
      <span class="status" [class.valid]="pdfForm.valid()">
        {{ pdfForm.valid() ? '✓ Valid' : '✗ Incomplete' }}
      </span>
      <button [disabled]="!pdfForm.valid()" (click)="pdfForm.export()">Export PDF</button>
      <label class="open">
        Open PDF…
        <input type="file" accept="application/pdf" hidden (change)="onPick($event)" />
      </label>
    </header>
    <pdf-viewer />
  `,
  styles: [`
    :host {
      display: flex; flex-direction: column; align-items: center; gap: 1.5rem;
      min-height: 100vh; padding: 2rem; box-sizing: border-box;
      background: #14141f; color: #eee; font-family: system-ui, sans-serif;
      transition: background 0.2s;
    }
    :host(.dropping) { background: #1d2b4a; }
    header { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; justify-content: center; }
    h1 { margin: 0; font-size: 1.2rem; font-weight: 500; }
    .file { margin-left: 0.5rem; color: #8a8aa0; font: 0.9rem ui-monospace, monospace; }
    .status, button, .open { font-size: 0.85rem; padding: 4px 12px; border-radius: 12px; }
    .status { background: #3a2a2a; color: #e8a0a0; }
    .status.valid { background: #1b5e20; color: #a5d6a7; }
    button { border: 1px solid #3a7bd5; background: #3a7bd5; color: #fff; cursor: pointer; }
    button:disabled { background: transparent; border-color: #444; color: #666; cursor: not-allowed; }
    .open { border: 1px solid #444; color: #aaa; cursor: pointer; }
  `],
})
export class App {
  protected readonly pdfForm = inject(PdfFormService);
  protected readonly dropping = signal(false);

  constructor() {
    this.pdfForm.open('/assets/demo-invoice.pdf', invoiceRules);
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    this.dropping.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.pdfForm.open(file); // a PDF this app has never seen: no rules, just its schema
  }

  protected onPick(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.pdfForm.open(file);
  }
}
