// npm run simulate -- [--patients=1000] [--pay-rate=0.2] [--testing-pay-rate=0.2]
// Genera pacientes sintéticas que recorren el wizard a través del factory, igual que la API.
// Con las dos tasas iguales es un control A/A; con tasas distintas simula un efecto real.
import { getBookingService } from '../src/bookings/factory.ts';
import { BookingStableService } from '../src/bookings/stable.service.ts';
import { arg, withDb } from './cli.ts';

const patients = Number(arg('patients') ?? 1000);
const payRate = Number(arg('pay-rate') ?? 0.2);
const testingPayRate = Number(arg('testing-pay-rate') ?? payRate);
const RETRY_RATE = 0.15; // pacientes que abandonan y vuelven a intentar con el mismo email

await withDb(async (db) => {
  const stable = new BookingStableService(db);
  if (!(await stable.experiments.getActive())) {
    console.error('No hay experimento activo: todo el tráfico iría a stable. Crear uno con npm run experiment:create.');
    process.exitCode = 1;
    return;
  }
  let created = 0;
  for (let i = 0; i < patients; i++) {
    const email = `paciente-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const attempts = Math.random() < RETRY_RATE ? 2 : 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const { _id } = await stable.init(); // identidad desconocida al entrar al wizard
      const booking = await (await getBookingService(db, _id)).start(_id, email);
      created++;
      const service = await getBookingService(db, _id);
      await service.selectSlot(_id, new Date(Date.now() + (1 + Math.random() * 14) * 24 * 60 * 60 * 1000));
      const rate = booking.effectiveVariant === 'testing' ? testingPayRate : payRate;
      if (attempt === attempts && Math.random() < rate) await service.pay(_id);
    }
  }
  console.log(`Listo: ${patients} pacientes, ${created} bookings. Ver resultados con npm run report.`);
});
