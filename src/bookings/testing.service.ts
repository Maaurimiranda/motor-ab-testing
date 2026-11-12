import { bookings } from '../db.ts';
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
 * Variante de prueba. Experimento en curso: "anticipación de exámenes y reagendamiento".
 *  1. La paciente confirma, antes de elegir fecha, que entiende qué exámenes necesita.
 *  2. Las citas de anticipación corta se pueden reagendar mientras no hayan ocurrido.
 * Todo lo demás se hereda del flujo estable, que no se toca.
 *
 * Al cerrar el experimento: si gana, estos métodos pasan a BookingStableService y la clase
 * queda vacía; si pierde, se borran sin tocar el estable. Para un control A/A, la clase queda vacía.
 */
export class BookingTestingService extends BookingStableService {
  async acknowledgeExams(bookingId: string) {
    await this.findOrThrow(bookingId);
    // Marca de tiempo y no booleano: queda registrado cuándo consintió.
    await bookings(this.db).updateOne({ _id: bookingId }, { $set: { 'metadata.examsAcknowledgedAt': new Date() } });
    return this.get(bookingId);
  }

  canReschedule(booking: Booking, now: Date): boolean {
    if (booking.status === 'paid' && booking.datetime && isShortNotice(booking)) {
      return booking.datetime.getTime() > now.getTime();
    }
    return super.canReschedule(booking, now);
  }
}
