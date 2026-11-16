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
