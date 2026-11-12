import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MongoServerError } from 'mongodb';
import { computeVariant, ExperimentService } from '../src/experiment.service.ts';
import { useDb } from './helpers.ts';

const ctx = useDb();
const emails = Array.from({ length: 200 }, (_, i) => `paciente${i}@example.com`);
const exp = (splitPercentage: number) => ({
  experimentId: 'exp',
  bucketingType: 'percentage' as const,
  bucketingData: { splitPercentage },
});

test('splitPercentage 0: siempre stable; 100: siempre testing', () => {
  assert.ok(emails.every((e) => computeVariant(exp(0), e) === 'stable'));
  assert.ok(emails.every((e) => computeVariant(exp(100), e) === 'testing'));
});

test('la asignación ignora mayúsculas y espacios del email', () => {
  for (const e of emails) assert.equal(computeVariant(exp(50), e), computeVariant(exp(50), `  ${e.toUpperCase()} `));
});

test('sin experimento activo: stable y experimentId null', async () => {
  assert.deepEqual(await new ExperimentService(ctx.db).resolve('ana@example.com'), { experimentId: null, variant: 'stable' });
});

test('la base de datos rechaza un segundo experimento activo, y lo acepta después de cerrar el primero', async () => {
  const service = new ExperimentService(ctx.db);
  await service.create({ experimentId: 'a', description: 'primero', splitPercentage: 50 });
  await assert.rejects(
    service.create({ experimentId: 'b', description: 'segundo', splitPercentage: 50 }),
    (err) => err instanceof MongoServerError && err.code === 11000,
  );
  const closed = await service.closeActive('kill-switch');
  assert.equal(closed?.endedReason, 'kill-switch');
  await service.create({ experimentId: 'b', description: 'segundo', splitPercentage: 50 });
  assert.equal((await service.getActive())?.experimentId, 'b');
});
