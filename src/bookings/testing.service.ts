import type { Booking } from '../models.ts';
import { BookingStableService, HOUR } from './stable.service.ts';

const SHORT_NOTICE_HOURS = 24;

/** Cita comprada con menos de 24 h de anticipación (se calcula al vuelo, sin persistir un flag). */
export function isShortNotice(booking: Booking): boolean {
  const appointment = booking.metadata.originalDatetime ?? booking.datetime;
  if (!appointment) return false;
  return appointment.getTime() - booking.createdAt.getTime() < SHORT_NOTICE_HOURS * HOUR;
}

/**
 * Variante de prueba. Hoy contiene el experimento de ejemplo "reagendamiento flexible":
 * las citas de anticipación corta se pueden reagendar mientras no hayan ocurrido.
 * Todo lo demás se hereda del flujo estable.
 *
 * Al cerrar el experimento: si gana, este método pasa a BookingStableService y se borra la
 * clase; si pierde, se borra la clase sin tocar el estable. Para un control A/A, la clase queda vacía.
 */
export class BookingTestingService extends BookingStableService {
  canReschedule(booking: Booking, now: Date): boolean {
    if (booking.status === 'paid' && booking.datetime && isShortNotice(booking)) {
      return booking.datetime.getTime() > now.getTime();
    }
    return super.canReschedule(booking, now);
  }
}
