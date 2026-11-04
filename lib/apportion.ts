/** Round a set of amounts to cents so the rounded parts still add up to the rounded whole
 *  (largest remainder). Rounding each card's rewards on its own left the receipt a cent off
 *  its own total: Jordan's three card nets came to −$427.02 under a NET of −$427.03. */
export function apportion(values: number[]): number[] {
  const cents = values.map((v) => v * 100);
  const floors = cents.map(Math.floor);
  let left = Math.round(cents.reduce((a, b) => a + b, 0)) - floors.reduce((a, b) => a + b, 0);
  const order = cents.map((c, i) => [c - Math.floor(c), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors.map((c) => c / 100);
}
