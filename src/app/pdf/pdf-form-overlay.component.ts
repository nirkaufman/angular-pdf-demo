import { Component, effect, inject, inputBinding, viewChild, ViewContainerRef, type ComponentRef } from '@angular/core';
import { PdfFormService } from '../form/pdf-form.service';
import { PdfFieldComponent } from '../form/pdf-field.component';
import type { CssRect } from './pdf-schema';

/** Mounts one Angular component per PDF field, exactly where the PDF puts it. */
@Component({
  selector: 'pdf-form-overlay',
  template: `<ng-container #host />`,
  styles: [`:host { position: absolute; inset: 0; }`],
})
export class PdfFormOverlayComponent {
  private readonly host = viewChild.required('host', { read: ViewContainerRef });
  private readonly pdfForm = inject(PdfFormService);

  constructor() {
    effect(() => {
      const fields = this.pdfForm.document()?.fields ?? [];
      this.host().clear();

      // TODO (live): mount one PdfFieldComponent per field
    });
  }
}

/** Absolutely position a mounted component over its PDF rectangle. */
function placeAt(ref: ComponentRef<unknown>, rect: CssRect) {
  Object.assign((ref.location.nativeElement as HTMLElement).style, {
    position: 'absolute',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
}
