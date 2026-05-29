/** Maps Plaid personal_finance_category.primary to an internal category name, or null if no mapping. */
const PRIMARY_TO_CATEGORY: Record<string, string> = {
  FOOD_AND_DRINK: 'Food',
  ENTERTAINMENT: 'Entertainment',
  GENERAL_MERCHANDISE: 'Shopping',
  HOME_IMPROVEMENT: 'Housing',
  MEDICAL: 'Healthcare',
  PERSONAL_CARE: 'Shopping',
  TRANSPORTATION: 'Transport',
  TRAVEL: 'Transport',
  LOAN_PAYMENTS: 'Debt Payments',
};

const TRANSFER_PRIMARIES = new Set(['TRANSFER_IN', 'TRANSFER_OUT']);

export function isPlaidTransfer(primary: string | null | undefined): boolean {
  return primary != null && TRANSFER_PRIMARIES.has(primary);
}

/**
 * Returns the internal category name for a Plaid personal_finance_category pair,
 * or null if no mapping exists (caller should fall back to keyword matching).
 */
export function resolvePlaidCategoryName(
  primary: string | null | undefined,
  detailed: string | null | undefined,
): string | null {
  if (!primary || isPlaidTransfer(primary)) return null;

  // RENT_AND_UTILITIES needs detailed-level disambiguation
  if (primary === 'RENT_AND_UTILITIES') {
    const d = detailed ?? '';
    if (d.includes('RENT') || d.includes('MORTGAGE') || d.includes('HOA') || d.includes('HOMEOWNERS')) {
      return 'Housing';
    }
    return 'Utilities';
  }

  return PRIMARY_TO_CATEGORY[primary] ?? null;
}
