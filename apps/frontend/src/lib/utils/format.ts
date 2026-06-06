/** Formats a currency amount. Without a currency code: USD, no decimals. With a code: dynamic currency, 2 decimals. Returns "-" on null. */
export function formatCurrency(amount: number | null, currencyCode?: string | null): string {
  if (amount === null) return "-";
  const hasCurrencyCode = currencyCode != null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode ?? "USD",
    maximumFractionDigits: hasCurrencyCode ? 2 : 0,
  }).format(amount);
}
