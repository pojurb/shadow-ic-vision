/**
 * Formatting helpers shared across the finance engine.
 * Values are presented in Indonesian Rupiah / id-ID locale to match the product's market.
 */

/** Format a number as compact Rupiah (e.g. "Rp 1.20B", "Rp 245.45M", "-Rp 8.500"). */
export function formatIDR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  const negative = value < 0;
  const abs = Math.abs(value);
  let body: string;
  if (abs >= 1e12) body = `${(abs / 1e12).toFixed(2)}T`;
  else if (abs >= 1e9) body = `${(abs / 1e9).toFixed(2)}B`;
  else if (abs >= 1e6) body = `${(abs / 1e6).toFixed(2)}M`;
  else body = abs.toLocaleString("id-ID");
  return `${negative ? "-" : ""}Rp ${body}`;
}

/** Format a plain number with a fixed number of decimals using the id-ID locale. */
export function formatNum(value: number | null | undefined, decimals = 2): string {
  if (value == null || Number.isNaN(value)) return "0";
  return Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
