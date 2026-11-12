import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBookingService } from '../src/bookings/factory.ts';
import { BookingStableService, HOUR } from '../src/bookings/stable.service.ts';
import { BookingTestingService } from '../src/bookings/testing.service.ts';
import { ExperimentService } from '../src/experiment.service.ts';
import type { Booking } from '../src/models.ts';
import { useDb } from './helpers.ts';

const ctx = useDb();
const startExperiment = (experimentId: string, splitPercentage: number) =>
  new ExperimentService(ctx.db).create({ experimentId, description: experimentId, splitPercentage });

test('la variante se persiste en init() si el email se conoce, o en start() si no', async () => {
  await startExperiment('exp', 100);
  const stable = new BookingStableService(ctx.db);

  const conEmail = await stable.init('ana@example.com');
  assert.equal(conEmail.experimentId, 'exp');
  assert.equal(conEmail.experimentVariant, 'testing');

  const sinEmail = await stable.init();
  assert.equal(sinEmail.experimentId, undefined);
  assert.equal(sinEmail.effectiveVariant, 'stable');
  const iniciado = await stable.start(sinEmail._id, 'luz@example.com');
  assert.equal(iniciado.experimentVariant, 'testing');
});

test('una paciente que reintenta conserva su variante', async () => {
  await startExperiment('exp', 50);
  const stable = new BookingStableService(ctx.db);
  for (let i = 0; i < 50; i++) {
    const email = `paciente${i}@example.com`;
    const first = await stable.init(email);
    const retry = await stable.init(email.toUpperCase());
    assert.equal(retry.experimentVariant, first.experimentVariant);
  }
});

test('el factory entrega el servicio de prueba solo a bookings testing del experimento activo', async () => {
  await startExperiment('exp', 100);
  const { _id } = await new BookingStableService(ctx.db).init('ana@example.com');
  assert.ok((await getBookingService(ctx.db, _id)) instanceof BookingTestingService);
  assert.ok((await getBookingService(ctx.db, 'no-existe')).constructor === BookingStableService);
});

test('kill switch: sin deploy, el booking en curso pasa a stable en su siguiente respuesta', async () => {
  await startExperiment('exp', 100);
  const { _id } = await new BookingStableService(ctx.db).init('ana@example.com');
  assert.equal((await (await getBookingService(ctx.db, _id)).get(_id)).effectiveVariant, 'testing');

  await new ExperimentService(ctx.db).closeActive('kill-switch');

  const service = await getBookingService(ctx.db, _id);
  assert.ok(service.constructor === BookingStableService);
  const after = await service.get(_id);
  assert.equal(after.effectiveVariant, 'stable');
  assert.equal(after.experimentVariant, 'testing'); // el registro histórico no se toca
});

test('un booking de un experimento cerrado no se reasigna ni vuelve a testing cuando corre otro', async () => {
  await startExperiment('viejo', 100);
  const stable = new BookingStableService(ctx.db);
  const { _id } = await stable.init('ana@example.com');
  await new ExperimentService(ctx.db).closeActive('normal-closure');
  await startExperiment('nuevo', 100);

  const retomado = await (await getBookingService(ctx.db, _id)).start(_id, 'ana@example.com');
  assert.equal(retomado.experimentId, 'viejo'); // escritura condicional: no pisa la asignación original
  assert.equal(retomado.effectiveVariant, 'stable');
});

test('promovido a estable: se pueden reagendar citas de anticipación corta mientras no ocurrieron', () => {
  const now = new Date('2026-09-01T10:00:00Z');
  const booking: Booking = {
    _id: 'b1',
    status: 'paid',
    createdAt: new Date(now.getTime() - 2 * HOUR), // comprada 2 h antes...
    datetime: new Date(now.getTime() + 5 * HOUR), // ...para dentro de 5 h: anticipación corta
    metadata: {},
  };
  const stable = new BookingStableService(ctx.db);
  assert.equal(stable.canReschedule(booking, now), true);

  const pasada = { ...booking, datetime: new Date(now.getTime() - HOUR), createdAt: new Date(now.getTime() - 10 * HOUR) };
  assert.equal(stable.canReschedule(pasada, now), false);

  const normal = { ...booking, createdAt: new Date(now.getTime() - 10 * 24 * HOUR) }; // comprada con días de aviso
  assert.equal(stable.canReschedule(normal, now), false); // a 5 h de la cita rige la política de 24 h
});
