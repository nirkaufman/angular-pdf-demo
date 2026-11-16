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
