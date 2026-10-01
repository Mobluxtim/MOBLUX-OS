/** Display-only half-up rounding without converting exact decimal quantities to Number. */
export function displayQuantity(value: string): string {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return value;
  const [whole, fraction = ''] = value.split('.');
  const padded = fraction.padEnd(3, '0');
  const cents = BigInt(whole) * 100n + BigInt(padded.slice(0, 2)) + (padded[2] >= '5' ? 1n : 0n);
  const tail = (cents % 100n).toString().padStart(2, '0').replace(/0+$/, '');
  return `${cents / 100n}${tail ? `.${tail}` : ''}`;
}
