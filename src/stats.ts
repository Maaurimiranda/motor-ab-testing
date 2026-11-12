// Función de distribución normal estándar (erf de Abramowitz y Stegun 7.1.26, error < 1.5e-7).
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** z-test de dos proporciones, bilateral, varianza combinada. Grupo 1 = stable, grupo 2 = testing. */
export function twoProportionZTest(x1: number, n1: number, x2: number, n2: number) {
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pooled = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  const z = se === 0 ? 0 : (p2 - p1) / se;
  return { p1, p2, diff: p2 - p1, z, pValue: 2 * (1 - normalCdf(Math.abs(z))) };
}

/** z binomial: ¿la proporción observada de 'testing' es compatible con el split configurado? */
export function balanceTest(testing: number, total: number, expectedShare: number) {
  const z = (testing - total * expectedShare) / Math.sqrt(total * expectedShare * (1 - expectedShare));
  return { share: testing / total, z, pValue: 2 * (1 - normalCdf(Math.abs(z))) };
}
