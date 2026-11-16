import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

// Point PDF.js at its worker — required
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.mjs';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
  ]
};
