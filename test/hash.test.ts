import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashCode } from '../src/hash.ts';
import { twoProportionZTest } from '../src/stats.ts';

const N = 20_000;
const emails = Array.from({ length: N }, (_, i) => `exp-2026:paciente${i}@example.com`);

test('el hash es determinístico', () => {
  assert.equal(hashCode('exp:ana@example.com'), hashCode('exp:ana@example.com'));
});

test('con el hash corregido, el split 50/50 queda a menos de 1 punto', () => {
  const testing = emails.filter((e) => hashCode(e) % 100 < 50).length;
  assert.ok(Math.abs(testing / N - 0.5) < 0.01, `testing = ${testing / N}`);
});

test('regresión del bug original: elevar al cuadrado antes del módulo colapsa los buckets y sesga el split', () => {
  const buckets = emails.map((e) => BigInt(hashCode(e)) ** 2n % 100n);
  assert.equal(new Set(buckets).size, 22); // residuos cuadráticos módulo 100
  const below50 = buckets.filter((b) => b < 50n).length / N;
  assert.ok(below50 > 0.6, `por debajo de 50: ${below50}`); // nunca un 50/50 real
});

test('z-test de dos proporciones reproduce un resultado conocido (control A/A: p ≈ 0,053)', () => {
  const { z, pValue } = twoProportionZTest(120, 723, 159, 776);
  assert.ok(Math.abs(z - 1.93) < 0.01, `z = ${z}`);
  assert.ok(Math.abs(pValue - 0.053) < 0.002, `p = ${pValue}`);
});
