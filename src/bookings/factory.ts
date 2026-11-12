import type { Db } from 'mongodb';
import { bookings, experiments } from '../db.ts';
import { BookingStableService } from './stable.service.ts';
import { BookingTestingService } from './testing.service.ts';

/**
 * Único punto donde se decide qué flujo atiende un booking. Los handlers nunca hacen `new`.
 * Usa la variante de prueba solo si el experimento del booking es el que sigue activo:
 * un booking de un experimento cerrado vuelve al estable aunque su experimentVariant diga 'testing'.
 */
export async function getBookingService(db: Db, bookingId: string): Promise<BookingStableService> {
  // Dos lecturas independientes, en paralelo, para no sumar latencia.
  const [booking, active] = await Promise.all([
    bookings(db).findOne({ _id: bookingId }),
    experiments(db).findOne({ active: true }),
  ]);
  const inRunningTesting =
    booking?.experimentId !== undefined &&
    booking.experimentId === active?.experimentId &&
    booking.experimentVariant === 'testing';
  return inRunningTesting ? new BookingTestingService(db) : new BookingStableService(db);
}
