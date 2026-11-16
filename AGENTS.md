# AGENTS.md: Any PDF Form, as a Live Angular App
## Context for Claude Code

> Code blocks in this file are the working source of this repo (Angular 22.1,
> `pdfjs-dist@6.2.108`, `pdf-lib@1.17`), embedded verbatim. They compile and run as
> shown. The on-stage script is `../talk-walkthrough.md`.

---

## What we are building

A conference demo that proves one thesis:

> **Every fillable PDF already carries a component schema. Angular can turn it into a live app, and hand back a real PDF.**

How it works, precisely: Angular does **not** run inside the PDF file (no viewer would
allow that). The file stays untouched. The app renders page 1 with PDF.js, reads the
file's own form schema (field names, types, positions, `required` / `readOnly` /
`maxLength` flags, dropdown options), mounts one Angular component per field at the
exact position the PDF specifies, and backs them with a Signal Form generated from
those flags. Export writes the values back into a copy of the original file's own
AcroForm fields with pdf-lib. File in, Angular in the middle, file out.

It works on PDFs the app has never seen: drop any AcroForm PDF on the page and it
becomes a live form with zero new code. Domain logic the PDF can't express (computed
totals, extra validation) is added per document as **rules** attached by field name.

Constraints of a live-coded talk:
- Three short on-stage edits (1 word, 6 lines, 5 lines). Everything else is pre-built
- Nothing may depend on the network (airplane mode)

---

## Tech stack

- **Angular v22.1** (Node **22.22.3+ / 24.15+ / 26+**, or the CLI refuses to run)
- **Zoneless** (default in v22, do NOT add Zone.js); **OnPush** is the default, don't specify it
- **Signal Forms** (`@angular/forms/signals`): `form()`, `required`, `readonly`, `maxLength`, `minLength`, and the **`[formField]`** directive on native controls
- **`inputBinding()`** for dynamic component inputs, never `setInput()`
- **`@Service()`** instead of `@Injectable({ providedIn: 'root' })`
- **pdfjs-dist 6.2.x**: rendering and annotation extraction
- **pdf-lib**: generating the demo PDFs (script) and writing values back (export, lazy-loaded)
- Standalone components, Signals throughout, no RxJS, TypeScript strict

---

## Read this first: API gotchas

All of these were hit while building this repo. Do not write the "obvious" version.

| # | Don't write | Because | Write this |
|---|---|---|---|
| 1 | `getDocument(url)` | TS2559 in this version | `getDocument({ data })` (or `{ url }`) |
| 2 | `getDocument({ data: bytes })` and then reuse `bytes` | pdf.js transfers the buffer to its worker, detaching it | Pass `bytes.slice()`, keep the original for export |
| 3 | `page.render({ canvasContext, viewport })` | `canvas` is required in `RenderParameters` | `page.render({ canvas, canvasContext, viewport, ... })` |
| 4 | `viewport.convertToViewportRectangle(rect)` | Removed, TS2339 | `convertToViewportPoint(x, y)` on both corners, build the box |
| 5 | `AnnotationMode.ENABLE_FORMS` on a canvas-only render, expecting typeable fields | Interactive widgets need PDF.js's HTML annotation layer, which this app doesn't use | `DISABLE` (we own the form layer). `ENABLE` draws static field pictures |
| 6 | `form(model, schema)` outside an injection context | `form()` calls `inject()` → `NG0203` | `form(model, schema, { injector })` |
| 7 | `formTree[name]` as the field state | That's a `FieldTree` | `formTree[name]()` gives `touched()`, `errors()`, `valid()` |
| 8 | An `effect()` that writes computed totals into the form model | Effect-writes-signal anti-pattern | Keep derived values as `computed()` signals beside the model, merge them on export |
| 9 | `.control:read-only` CSS for read-only styling | `:read-only` also matches every `<select>` | `input.control:read-only` |
| 10 | `import { PDFDocument } from 'pdf-lib'` at the top of app code | Pushes the initial bundle past the 1 MB error budget | `await import('pdf-lib')` inside the export |
| 11 | `path.clientName` | `noPropertyAccessFromIndexSignature` is on | `path['clientName']` |
| 12 | `app.component.ts` / `AppComponent` | Angular 22.1 scaffolds `App` in `app.ts` | `App` |

---

## Architecture

```
PDF file (URL or dropped File)
      │  loadPdf(): pdf.js getAnnotations()  ──►  console.table(schema)
      ▼
PdfField[]  { name, type, value, options, required, readOnly, maxLength, rect }
      │
      ▼
PdfFormService.open(source, rules?)
  - model    = signal({ [name]: value })                 one entry per field
  - derived  = rules.compute → computed() per field       e.g. total, vat
  - form     = form(model, path => {
                 required / readonly / maxLength          ◄── from the PDF's flags
                 rules.validate(path)                     ◄── domain rules
               }, { injector })
      │
      ├──► PdfViewerComponent        canvas render, AnnotationMode.DISABLE
      ├──► PdfFormOverlayComponent   createComponent(PdfFieldComponent) per field,
      │                              placeAt(field.rect)
      │        └──► PdfFieldComponent  <input|select [formField]> or a derived value
      │
      └──► export(): pdf-lib loads the original bytes, sets each field by name,
                     downloads <name>-filled.pdf
```

---

## File structure

```
angular-pdf-demo/
├── scripts/
│   ├── generate-demo-pdf.mts         # pdf-lib: builds both demo PDFs   (npm run pdfs)
│   └── stage.mts                     # toggles the 3 live edits         (npm run stage:start|final)
├── demo-pdfs/
│   └── speaker-expense-claim.pdf     # the "unseen" PDF, NOT served by the app
├── src/
│   ├── assets/demo-invoice.pdf       # opened on start
│   └── app/
│       ├── app.ts                    # header, badge, export, drop target
│       ├── app.config.ts             # PDF.js worker path
│       ├── pdf/
│       │   ├── pdf-schema.ts         # annotations → PdfField[], rect flip  (+ spec)
│       │   ├── load-pdf.ts           # load page 1, read schema, log table
│       │   ├── pdf-viewer.component.ts          # live edit 1
│       │   ├── pdf-form-overlay.component.ts    # live edit 2
│       │   └── export-pdf.ts         # PDF out
│       └── form/
│           ├── pdf-form.service.ts   # PDF schema + rules → Signal Form
│           ├── pdf-field.component.ts
│           └── invoice.rules.ts      # live edit 3
└── angular.json                      # assets: PDF.js worker + demo invoice
```

---

## Step-by-step implementation

### Step 0. Scaffold

```bash
ng new angular-pdf-demo --style=scss --ssr=false
cd angular-pdf-demo
npm install pdfjs-dist pdf-lib
npm install -D tsx
node -v && ng version     # Node 22.22.3+ / 24.15+ / 26+, Angular 22.x
```

v22 scaffolds without Zone.js. Confirm `angular.json` has no `zone.js` polyfill.

### Step 1. Generate the demo PDFs

AcroForm fields only (not XFA). The invoice's field names are the contract with
`invoice.rules.ts`; its visible labels are decoration. Flags set here (`required`,
`readOnly`, `maxLength`) become Signal Forms logic automatically.

`scripts/generate-demo-pdf.mts`:
```typescript
/**
 * Generates the two demo PDFs with pdf-lib.
 *
 *   src/assets/demo-invoice.pdf          the invoice the app opens on start
 *   demo-pdfs/speaker-expense-claim.pdf  the "unseen" form you drop in on stage.
 *                                        Deliberately NOT under src/assets: the app
 *                                        never fetches it and has no code for it.
 *
 * Run: npx tsx scripts/generate-demo-pdf.mts   (or: npm run pdfs)
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';

const INK = rgb(0.2, 0.2, 0.2);
const TITLE = rgb(0.1, 0.1, 0.4);

async function setup() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, page, font, bold };
}

function heading(page: PDFPage, bold: PDFFont, font: PDFFont, title: string, subtitle: string) {
  page.drawText(title, { x: 50, y: 790, size: 22, font: bold, color: TITLE });
  page.drawText(subtitle, { x: 50, y: 768, size: 12, font, color: rgb(0.35, 0.35, 0.35) });
}

function label(page: PDFPage, font: PDFFont, text: string, y: number) {
  page.drawText(text, { x: 50, y: y + 6, size: 12, font, color: INK });
}

async function createInvoice() {
  const { doc, page, font, bold } = await setup();
  heading(page, bold, font, 'FAVORS & GRUDGES LTD.', 'Statement of Owed Favors');
  const form = doc.getForm();

  // [label, field name, y, width, flags]. Field names are the contract with
  // invoice.rules.ts; labels are decoration.
  const rows: [string, string, number, number, { required?: boolean; readOnly?: boolean }][] = [
    ['Who owes you:',      'clientName',  710, 300, { required: true }],
    ['Date of grudge:',    'invoiceDate', 670, 200, {}],
    ['Favor rendered:',    'description', 610, 300, { required: true }],
    ['Number of favors:',  'quantity',    570, 100, {}],
    ['Beers per favor:',   'unitPrice',   530, 150, {}],
    ['Total beers owed:',  'total',       490, 150, { readOnly: true }],
    ['Guilt Tax (23%):',   'vat',         450, 150, { readOnly: true }],
    ['Grand total beers:', 'grandTotal',  410, 150, { readOnly: true }],
  ];

  for (const [text, name, y, width, flags] of rows) {
    label(page, font, text, y);
    const field = form.createTextField(name);
    if (flags.required) field.enableRequired();
    if (flags.readOnly) field.enableReadOnly();
    field.addToPage(page, { x: 200, y, width, height: 22, borderWidth: 1 });
  }

  write('src/assets/demo-invoice.pdf', await doc.save());
}

async function createExpenseClaim() {
  const { doc, page, font, bold } = await setup();
  heading(page, bold, font, 'NG-POLAND 2026', 'Speaker Expense Claim');
  const form = doc.getForm();
  const box = { x: 200, height: 22, borderWidth: 1 };

  const text = (name: string, y: number, width: number, opts: { required?: boolean; maxLength?: number } = {}) => {
    const field = form.createTextField(name);
    if (opts.required) field.enableRequired();
    if (opts.maxLength) field.setMaxLength(opts.maxLength);
    field.addToPage(page, { ...box, y, width });
  };
  const select = (name: string, y: number, options: string[]) => {
    const field = form.createDropdown(name);
    field.addOptions(options);
    field.addToPage(page, { ...box, y, width: 200 });
  };
  const check = (name: string, x: number, y: number, caption: string, required = false) => {
    const field = form.createCheckBox(name);
    if (required) field.enableRequired();
    field.addToPage(page, { x, y, width: 16, height: 16, borderWidth: 1 });
    page.drawText(caption, { x: x + 24, y: y + 3, size: 12, font, color: INK });
  };

  label(page, font, 'Full name:', 710);        text('fullName', 710, 300, { required: true });
  label(page, font, 'E-mail:', 675);           text('email', 675, 300, { required: true });
  label(page, font, 'Talk title:', 640);       text('talkTitle', 640, 300, { required: true });
  label(page, font, 'Arrival date:', 605);     text('arrivalDate', 605, 150);
  label(page, font, 'Arriving in:', 570);      select('city', 570, ['Warsaw', 'Krakow', 'Gdansk', 'Wroclaw']);
  label(page, font, 'Travelling by:', 535);    select('transport', 535, ['Train', 'Plane', 'Car', 'Teleportation']);
  label(page, font, 'Claiming for:', 500);
  check('flight', 200, 503, 'Travel');
  check('hotel', 290, 503, 'Hotel');
  check('dinner', 380, 503, 'Speaker dinner');
  label(page, font, 'Amount (PLN):', 465);     text('amount', 465, 120, { maxLength: 8 });
  label(page, font, 'IBAN:', 430);             text('iban', 430, 300, { required: true, maxLength: 28 });
  check('noAi', 50, 390, 'I confirm no AI wrote this talk', true);

  write('demo-pdfs/speaker-expense-claim.pdf', await doc.save());
}

function write(path: string, bytes: Uint8Array) {
  fs.mkdirSync(path.substring(0, path.lastIndexOf('/')), { recursive: true });
  fs.writeFileSync(path, bytes);
  console.log(`Created ${path}`);
}

await createInvoice();
await createExpenseClaim();
```

Run: `npm run pdfs` (= `npx tsx scripts/generate-demo-pdf.mts`)

### Step 2. PDF.js worker and assets

`src/app/app.config.ts`:
```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

// Point PDF.js at its worker — required
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.mjs';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
  ]
};
```

`angular.json`, build target `assets`:
```json
{ "glob": "pdf.worker.min.mjs", "input": "node_modules/pdfjs-dist/build/", "output": "/" },
{ "glob": "demo-invoice.pdf", "input": "src/assets/", "output": "/assets/" }
```

The initial bundle (~650 kB) exceeds the 500 kB *warning* budget; that's expected.
Stay under the 1 MB *error* budget (gotcha 10).

### Step 3. The schema: annotations → fields

`src/app/pdf/pdf-schema.ts`:
```typescript
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
```

### Step 4. Load a PDF

`src/app/pdf/load-pdf.ts`:
```typescript
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
```

### Step 5. PdfFormService: PDF schema + rules → Signal Form

The PDF's flags become `required` / `readonly` / `maxLength`. Rules add domain
validation and derived (computed, read-only) fields.

`src/app/form/pdf-form.service.ts`:
```typescript
import { computed, inject, Injector, Service, signal, type Signal, type WritableSignal } from '@angular/core';
import { form, maxLength, readonly, required, type FieldTree, type SchemaPathTree } from '@angular/forms/signals';
import { loadPdf, type LoadedPdf } from '../pdf/load-pdf';
import { exportFilledPdf } from '../pdf/export-pdf';

export type FormModel = Record<string, string | boolean>;

/**
 * Domain rules a PDF can't express, attached to its fields by name.
 * `validate` gets Signal Forms schema paths (typed as text fields, which is what
 * rules target in practice); `compute` declares read-only derived fields.
 */
export interface FormRules {
  validate?: (path: SchemaPathTree<Record<string, string>>) => void;
  compute?: (ctx: {
    num: (name: string) => number;
    derive: (name: string, fn: () => number) => Signal<number>;
  }) => void;
}

interface Session {
  pdf: LoadedPdf;
  model: WritableSignal<FormModel>;
  form: FieldTree<FormModel>;
  derived: Map<string, Signal<number>>;
}

/** Turns any PDF form into a live Signal Form, and back into a PDF. */
@Service()
export class PdfFormService {
  private readonly injector = inject(Injector);
  private readonly session = signal<Session | null>(null);

  readonly document = computed(() => this.session()?.pdf ?? null);
  readonly valid = computed(() => this.session()?.form().valid() ?? false);

  async open(source: string | File, rules: FormRules = {}): Promise<void> {
    this.session.set(this.build(await loadPdf(source), rules));
  }

  /** The Signal Forms field for a PDF field name. */
  field(name: string): FieldTree<string | boolean> | undefined {
    return this.session()?.form[name];
  }

  /** The computed value for a derived field, if a rule declared one. */
  derived(name: string): Signal<number> | undefined {
    return this.session()?.derived.get(name);
  }

  async export(): Promise<void> {
    const s = this.session();
    if (!s) return;
    const values: FormModel = { ...s.model() };
    for (const [name, value] of s.derived) values[name] = value().toFixed(2);
    await exportFilledPdf(s.pdf.bytes, values, s.pdf.name.replace(/\.pdf$/i, '') + '-filled.pdf');
  }

  private build(pdf: LoadedPdf, rules: FormRules): Session {
    const fields = new Map(pdf.fields.map(f => [f.name, f])); // a field can have several widgets
    const model = signal<FormModel>(Object.fromEntries([...fields].map(([name, f]) => [name, f.value])));

    const derived = new Map<string, Signal<number>>();
    rules.compute?.({
      num: name => Number(String(model()[name] ?? '').replace(',', '.')) || 0,
      derive: (name, fn) => {
        const value = computed(fn);
        derived.set(name, value);
        return value;
      },
    });

    const tree = form(model, path => {
      // The PDF's own flags become Signal Forms logic. Nobody writes these per form.
      for (const f of fields.values()) {
        if (f.required) required(path[f.name], { message: 'Required by this PDF' });
        if (f.readOnly || derived.has(f.name)) readonly(path[f.name]);
        if (f.maxLength) {
          maxLength(path[f.name] as SchemaPathTree<string>, f.maxLength,
            { message: `Max ${f.maxLength} characters` });
        }
      }
      rules.validate?.(path as unknown as SchemaPathTree<Record<string, string>>);
    }, { injector: this.injector });

    return { pdf, model, form: tree, derived };
  }
}
```

### Step 6. Viewer (live edit 1)

`src/app/pdf/pdf-viewer.component.ts`:
```typescript
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
      annotationMode: AnnotationMode.DISABLE, // we own the form layer
    });
    this.task.promise.catch(e => { if (e?.name !== 'RenderingCancelledException') throw e; });
  }
}
```

### Step 7. Overlay (live edit 2)

`src/app/pdf/pdf-form-overlay.component.ts`:
```typescript
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

      for (const field of fields) {
        const ref = this.host().createComponent(PdfFieldComponent, {
          bindings: [inputBinding('field', () => field)],
        });
        placeAt(ref, field.rect);
      }
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
```

### Step 8. One field

`src/app/form/pdf-field.component.ts`:
```typescript
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
```

### Step 9. Invoice rules (live edit 3)

`src/app/form/invoice.rules.ts`:
```typescript
import { minLength } from '@angular/forms/signals';
import type { FormRules } from './pdf-form.service';

/** What the invoice PDF can't express on its own. Attached to its fields by name. */
export const invoiceRules: FormRules = {
  validate: path => {
    minLength(path['clientName'], 2, { message: 'At least 2 characters' });
  },
  compute: ({ num, derive }) => {
    const total = derive('total', () => num('quantity') * num('unitPrice'));
    const vat = derive('vat', () => total() * 0.23);
    derive('grandTotal', () => total() + vat());
  },
};
```

### Step 10. Export (PDF out)

`src/app/pdf/export-pdf.ts`:
```typescript
/** PDF out: write values into a copy of the original file's own form fields, by name. */
export async function exportFilledPdf(
  original: Uint8Array,
  values: Record<string, string | boolean>,
  fileName: string,
): Promise<void> {
  // Lazy: pdf-lib is only needed on click, keep it out of the initial bundle
  const { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList } = await import('pdf-lib');
  const doc = await PDFDocument.load(original);
  const form = doc.getForm();

  for (const [name, value] of Object.entries(values)) {
    const field = form.getFieldMaybe(name);
    if (field instanceof PDFTextField) field.setText(String(value));
    else if (field instanceof PDFCheckBox) value ? field.check() : field.uncheck();
    else if ((field instanceof PDFDropdown || field instanceof PDFOptionList) && value) {
      field.select(String(value));
    }
  }

  const url = URL.createObjectURL(new Blob([await doc.save() as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Step 11. Root component

The invoice opens with its rules. A dropped or picked file opens with none: it runs on
its own schema alone.

`src/app/app.ts`:
```typescript
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
```

### Step 12. Stage helper

`scripts/stage.mts` swaps the three live edits out (`npm run stage:start`) and back in
(`npm run stage:final`) by exact text. It refuses to touch a file that has drifted.

```typescript
/**
 * Switch the repo between the finished demo and the on-stage starting point.
 *
 *   npm run stage:start   strip the three live edits (do this before rehearsing / walking on)
 *   npm run stage:final   put them back (the committed, fully working state)
 *
 * Each live edit is an exact-text swap. If a file has drifted, the script stops
 * and changes nothing, rather than guessing.
 */
import * as fs from 'fs';

interface Swap { file: string; final: string; start: string }

const swaps: Swap[] = [
  {
    // Live edit 1: PDF.js stops drawing its own form fields
    file: 'src/app/pdf/pdf-viewer.component.ts',
    final: `      annotationMode: AnnotationMode.DISABLE, // we own the form layer`,
    start: `      annotationMode: AnnotationMode.ENABLE,`,
  },
  {
    // Live edit 2: one Angular component per PDF field
    file: 'src/app/pdf/pdf-form-overlay.component.ts',
    final: `      this.host().clear();

      for (const field of fields) {
        const ref = this.host().createComponent(PdfFieldComponent, {
          bindings: [inputBinding('field', () => field)],
        });
        placeAt(ref, field.rect);
      }`,
    start: `      this.host().clear();

      // TODO (live): mount one PdfFieldComponent per field`,
  },
  {
    // Live edit 3: what the PDF can't express
    file: 'src/app/form/invoice.rules.ts',
    final: `export const invoiceRules: FormRules = {
  validate: path => {
    minLength(path['clientName'], 2, { message: 'At least 2 characters' });
  },
  compute: ({ num, derive }) => {
    const total = derive('total', () => num('quantity') * num('unitPrice'));
    const vat = derive('vat', () => total() * 0.23);
    derive('grandTotal', () => total() + vat());
  },
};`,
    start: `export const invoiceRules: FormRules = {
  // TODO (live): validation + computed fields
};`,
  },
];

const target = process.argv[2];
if (target !== 'start' && target !== 'final') {
  console.error('Usage: tsx scripts/stage.mts start|final');
  process.exit(1);
}

const from = target === 'start' ? 'final' : 'start';
const plan = swaps.map(s => {
  const text = fs.readFileSync(s.file, 'utf8');
  if (text.includes(s[target])) return { s, text, skip: true };
  if (!text.includes(s[from])) {
    console.error(`✗ ${s.file}: neither the "${from}" nor the "${target}" snippet was found. Nothing changed.`);
    process.exit(1);
  }
  return { s, text, skip: false };
});

for (const { s, text, skip } of plan) {
  if (!skip) fs.writeFileSync(s.file, text.replace(s[from], s[target]));
  console.log(`${skip ? '·' : '✓'} ${s.file}${skip ? ' (already ' + target + ')' : ''}`);
}
console.log(`Stage is now: ${target}`);
```

---

## Verify

```bash
npm run pdfs
npm start            # http://localhost:4200
npx ng test --watch=false
npx ng build         # budget warning expected, no errors
```

In the browser (final state):
1. The invoice renders, with yellow Angular inputs exactly on the PDF's field positions
2. Reload with DevTools open: the console shows a table of the PDF's fields
3. Focus **Who owes you:** and blur it: *"Required by this PDF"* (from the PDF's flag)
4. Type `A`: *"At least 2 characters"* (from `invoice.rules.ts`)
5. Quantity `5`, unit price `100`: total `500.00`, VAT `115.00`, grand total `615.00`
6. With a valid form, **Export PDF** downloads `demo-invoice-filled.pdf`. Preview shows every value in real form fields
7. Drop `demo-pdfs/speaker-expense-claim.pdf` on the page: 12 fields (text, 2 dropdowns, 4 checkboxes) appear. It stays invalid until the required checkbox is ticked, and the amount enforces 8 characters
8. The Elements panel shows `<pdf-field data-field="...">` per field. The Network tab shows no requests after load

---

## Problems and fixes

| Problem | Likely cause | Fix |
|---|---|---|
| PDF renders, no fields | No AcroForm fields (XFA or flat PDF) | Use an AcroForm PDF. Generate with pdf-lib |
| Fields offset from the page | Rect not flipped | Gotcha 4 |
| `NG0203` on open | `form()` without an injector | Gotcha 6 |
| Export throws on a dropped PDF | The PDF was edited elsewhere, or a value is longer than the field's max length | The form blocks export until valid; check `maxLength` |
| `ng build` fails on bundle size | pdf-lib imported eagerly | Gotcha 10 |
| `stage.mts` refuses to run | A live-edit file differs from both snippets | `stage:final`, or restore the file, then retry |
| Dropdowns look read-only | `:read-only` CSS | Gotcha 9 |

---

## Scope and limits

- Page 1 only. Multi-page is a loop over `pdf.numPages`, one canvas and overlay each
- Text, checkbox and dropdown fields. Radio groups, push buttons and signatures are skipped
- AcroForm only; XFA forms are not supported
- Each control gets an `aria-label` from its field name. A production version should
  also read the PDF's tooltips (`TU`) and tab order

## What NOT to do

- Do NOT add `zone.js`, `standalone: true`, or explicit `OnPush`
- Do NOT use `setInput()`, `ngModel`, `ReactiveFormsModule`, or RxJS for state
- Do NOT write derived values into the model from an `effect()` (gotcha 8)
- Do NOT describe this as Angular running inside the PDF file
