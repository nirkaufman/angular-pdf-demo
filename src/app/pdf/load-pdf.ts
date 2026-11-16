import { getDocument, type PageViewport, type PDFPageProxy } from 'pdfjs-dist';
import { toFields, type PdfField } from './pdf-schema';

const SCALE = 1.5;

export interface LoadedPdf {
  name: string;
  /** The original, untouched file. Export writes into a copy of these bytes. */
  bytes: Uint8Array;
  page: PDFPageProxy;
  viewport: PageViewport;
  fields: PdfField[];
}

/** Load page 1 of a PDF from a URL or a dropped File, and read its form schema. */
export async function loadPdf(source: string | File): Promise<LoadedPdf> {
  const buffer = typeof source === 'string'
    ? await (await fetch(source)).arrayBuffer()
    : await source.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // pdf.js transfers the buffer to its worker, so hand it a copy
  const pdf = await getDocument({ data: bytes.slice() }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: SCALE });
  const fields = toFields(await page.getAnnotations(), viewport);

  console.table(fields.map(({ name, type, required, readOnly, rect }) =>
    ({ name, type, required, readOnly, x: Math.round(rect.left), y: Math.round(rect.top) })));

  const name = typeof source === 'string' ? source.split('/').pop()! : source.name;
  return { name, bytes, page, viewport, fields };
}
