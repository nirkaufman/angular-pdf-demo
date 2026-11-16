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
