/** Hash de un string (algoritmo de String.hashCode de Java), siempre no negativo. */
export function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  // Math.abs y no hash * hash: el cuadrado módulo 100 solo alcanza 22 de los 100 buckets
  // y sesga el split (bug real encontrado por el control A/A, ver test/hash.test.ts).
  return Math.abs(hash);
}
