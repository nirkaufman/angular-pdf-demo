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
