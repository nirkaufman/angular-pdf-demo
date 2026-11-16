import type { PageViewport } from 'pdfjs-dist';
import { toFields } from './pdf-schema';

// A 100pt-tall page at scale 1: PDF y=0 is CSS y=100
const viewport = { convertToViewportPoint: (x: number, y: number) => [x, 100 - y] } as unknown as PageViewport;
const widget = (data: object) => ({ subtype: 'Widget', rect: [10, 20, 60, 40], ...data });

describe('toFields', () => {
  it('maps text fields with their PDF flags and flips the rect to CSS space', () => {
    const [field] = toFields(
      [widget({ fieldName: 'clientName', fieldType: 'Tx', fieldValue: 'Acme', required: true, maxLen: 8 })],
      viewport,
    );
    expect(field).toEqual({
      name: 'clientName', type: 'text', value: 'Acme', options: [],
      required: true, readOnly: false, maxLength: 8,
      rect: { left: 10, top: 60, width: 50, height: 20 },
    });
  });

  it('maps checkboxes to booleans and choice fields to options', () => {
    const [check, select] = toFields([
      widget({ fieldName: 'noAi', fieldType: 'Btn', checkBox: true, fieldValue: 'Off' }),
      widget({
        fieldName: 'city', fieldType: 'Ch', fieldValue: ['Krakow'],
        options: [{ exportValue: 'Krakow', displayValue: 'Krakow' }],
      }),
    ], viewport);
    expect(check).toMatchObject({ type: 'checkbox', value: false });
    expect(select).toMatchObject({ type: 'select', value: 'Krakow', options: [{ value: 'Krakow', label: 'Krakow' }] });
  });

  it('skips radios, push buttons, signatures, hidden and non-widget annotations', () => {
    expect(toFields([
      widget({ fieldName: 'r', fieldType: 'Btn', radioButton: true }),
      widget({ fieldName: 'p', fieldType: 'Btn', pushButton: true }),
      widget({ fieldName: 's', fieldType: 'Sig' }),
      widget({ fieldName: 'h', fieldType: 'Tx', hidden: true }),
      { subtype: 'Link', rect: [0, 0, 1, 1] },
    ], viewport)).toEqual([]);
  });
});
