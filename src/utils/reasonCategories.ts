import type { ReasonCategory } from '../types';

export const REASON_CATEGORIES: { group: string; items: ReasonCategory[] }[] = [
  {
    group: 'Financial',
    items: [
      'Billing Correction',
      'Wrong Amount',
      'Duplicate Invoice',
      'Payment Adjustment',
      'Refund Correction',
      'Insurance Adjustment',
    ],
  },
  {
    group: 'Inventory',
    items: [
      'Damaged Item',
      'Expired Item',
      'Stock Count Difference',
      'Transfer Correction',
      'Supplier Error',
      'Manual Adjustment',
    ],
  },
  {
    group: 'Clinical',
    items: [
      'Treatment Plan Updated',
      'Clinical Correction',
      'Wrong Patient Selection',
    ],
  },
  {
    group: 'Administrative',
    items: [
      'Data Entry Error',
      'User Request',
      'Manager Decision',
      'Administrative Correction',
      'Other',
    ],
  },
];

export const REASON_CATEGORY_FLAT: ReasonCategory[] = REASON_CATEGORIES.flatMap(g => g.items);
