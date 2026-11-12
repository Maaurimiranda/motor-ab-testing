import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';
import { createApp } from '../src/app.ts';
import { ExperimentService } from '../src/experiment.service.ts';
import { useDb } from './helpers.ts';

const ctx = useDb();
let server: Server | undefined;

// Diferido: el server se crea en el primer request, cuando la base ya está lista.
function url(path: string) {
  server ??= createApp(ctx.db).listen(0);
  return `http://localhost:${(server.address() as AddressInfo).port}${path}`;
}
after(() => server?.close());

const post = (path: string, body: object = {}) =>
  fetch(url(path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('el paso de exámenes solo existe para la variante de prueba, y desaparece con el kill switch', async () => {
  await new ExperimentService(ctx.db).create({ experimentId: 'examenes', description: 'examenes', splitPercentage: 100 });
  const { _id } = await (await post('/bookings', { email: 'ana@example.com' })).json();

  const ack = await post(`/bookings/${_id}/exams-acknowledgement`);
  assert.equal(ack.status, 200);
  assert.ok((await ack.json()).metadata.examsAcknowledgedAt);

  await new ExperimentService(ctx.db).closeActive('kill-switch');
  assert.equal((await post(`/bookings/${_id}/exams-acknowledgement`)).status, 404);
});

test('valida el body y responde 404 a un booking inexistente', async () => {
  const { _id } = await (await post('/bookings')).json();
  assert.equal((await post(`/bookings/${_id}/start`, { email: 'no-es-email' })).status, 400);
  assert.equal((await fetch(url('/bookings/nada'))).status, 404);
});
