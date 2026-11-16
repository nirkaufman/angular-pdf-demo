import { minLength } from '@angular/forms/signals';
import type { FormRules } from './pdf-form.service';

/** What the invoice PDF can't express on its own. Attached to its fields by name. */
export const invoiceRules: FormRules = {
  // TODO (live): validation + computed fields
};
