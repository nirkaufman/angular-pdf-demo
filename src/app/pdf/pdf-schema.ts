import type { PageViewport } from 'pdfjs-dist';

export interface CssRect { left: number; top: number; width: number; height: number }

/** One form field, exactly as the PDF itself describes it. */
export interface PdfField {
  name: string;
  type: 'text' | 'checkbox' | 'select';
  value: string | boolean;
  options: { value: string; label: string }[];
  required: boolean;
  readOnly: boolean;
  maxLength: number | null;
  rect: CssRect;
}

/**
 * Turn PDF.js widget annotations into fields. Text, checkbox and choice fields are
 * supported; radio groups, push buttons and signatures are skipped.
 */
export function toFields(annotations: any[], viewport: PageViewport): PdfField[] {
  return annotations
    .filter(a => a.subtype === 'Widget' && !a.hidden && fieldType(a))
    .map(a => ({
      name: a.fieldName,
      type: fieldType(a)!,
      value: fieldValue(a),
      options: (a.options ?? []).map((o: any) => ({ value: o.exportValue, label: o.displayValue })),
      required: !!a.required,
      readOnly: !!a.readOnly,
      maxLength: a.maxLen || null,
      rect: toCssRect(a.rect, viewport),
    }));
}

function fieldType(a: any): PdfField['type'] | null {
  if (a.fieldType === 'Tx') return 'text';
  if (a.fieldType === 'Ch') return 'select';
  if (a.fieldType === 'Btn' && a.checkBox) return 'checkbox';
  return null;
}

function fieldValue(a: any): string | boolean {
  if (a.fieldType === 'Btn') return !!a.fieldValue && a.fieldValue !== 'Off';
  const v = Array.isArray(a.fieldValue) ? a.fieldValue[0] : a.fieldValue;
  return v ?? '';
}

/** PDF rects are [x1, y1, x2, y2] with the origin bottom-left; CSS is top-left. */
function toCssRect(rect: number[], viewport: PageViewport): CssRect {
  const [x1, y1] = viewport.convertToViewportPoint(rect[0], rect[1]);
  const [x2, y2] = viewport.convertToViewportPoint(rect[2], rect[3]);
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}
