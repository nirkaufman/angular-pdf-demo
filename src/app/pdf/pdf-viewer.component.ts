import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { AnnotationMode, type RenderTask } from 'pdfjs-dist';
import { PdfFormService } from '../form/pdf-form.service';
import { PdfFormOverlayComponent } from './pdf-form-overlay.component';
import type { LoadedPdf } from './load-pdf';

/** Draws the PDF page on a canvas and stacks the Angular form overlay on top. */
@Component({
  selector: 'pdf-viewer',
  imports: [PdfFormOverlayComponent],
  template: `
    <div class="page" [style.width.px]="pdf()?.viewport?.width" [style.height.px]="pdf()?.viewport?.height">
      <canvas #canvas></canvas>
      <pdf-form-overlay />
    </div>
  `,
  styles: [`
    .page { position: relative; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35); background: #fff; }
    canvas { display: block; width: 100%; height: 100%; }
  `],
})
export class PdfViewerComponent {
  protected readonly pdf = inject(PdfFormService).document;
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private task: RenderTask | null = null;

  constructor() {
    effect(() => {
      const pdf = this.pdf();
      if (pdf) this.render(pdf, this.canvas().nativeElement);
    });
  }

  private render({ page, viewport }: LoadedPdf, canvas: HTMLCanvasElement) {
    this.task?.cancel();
    const dpr = window.devicePixelRatio || 1; // crisp on HiDPI screens and projectors
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);

    this.task = page.render({
      canvas,
      canvasContext: canvas.getContext('2d')!,
      viewport,
      transform: [dpr, 0, 0, dpr, 0, 0],
      annotationMode: AnnotationMode.ENABLE,
    });
    this.task.promise.catch(e => { if (e?.name !== 'RenderingCancelledException') throw e; });
  }
}
