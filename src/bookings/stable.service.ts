import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { bookings } from '../db.ts';
import { ExperimentService, normalizeEmail } from '../experiment.service.ts';
import type { Booking, SerializedBooking } from '../models.ts';

export const HOUR = 60 * 60 * 1000;
export const RESCHEDULE_HOURS_NOTICE = 24;

export class NotFoundError extends Error {}
export class RescheduleNotAllowedError extends Error {}

/**
 * Flujo estable del wizard. No se modifica mientras corre un experimento:
 * BookingTestingService hereda de esta clase y sobrescribe solo lo que el experimento cambia.
 */
export class BookingStableService {
  db: Db;
  experiments: ExperimentService;

  constructor(db: Db) {
    this.db = db;
    this.experiments = new ExperimentService(db);
  }

  /** Paso 1. Si el email ya se conoce, la variante se asigna acá; si no, en start(). */
  async init(email?: string): Promise<SerializedBooking> {
    const booking: Booking = { _id: randomUUID(), status: 'started', createdAt: new Date(), metadata: {} };
    if (email) booking.email = normalizeEmail(email);
    await bookings(this.db).insertOne(booking);
    if (booking.email) await this.assignVariant(booking._id, booking.email);
    return this.get(booking._id);
  }

  async start(bookingId: string, email: string) {
    await this.findOrThrow(bookingId);
    const normalized = normalizeEmail(email);
    await bookings(this.db).updateOne({ _id: bookingId }, { $set: { email: normalized } });
    await this.assignVariant(bookingId, normalized);
    return this.get(bookingId);
  }

  async selectSlot(bookingId: string, datetime: Date) {
    await this.findOrThrow(bookingId);
    await bookings(this.db).updateOne({ _id: bookingId }, { $set: { status: 'slot-selected', datetime } });
    return this.get(bookingId);
  }

  async pay(bookingId: string) {
    await this.findOrThrow(bookingId);
    await bookings(this.db).updateOne({ _id: bookingId }, { $set: { status: 'paid', 'metadata.paidAt': new Date() } });
    return this.get(bookingId);
  }

  async reschedule(bookingId: string, datetime: Date) {
    const booking = await this.findOrThrow(bookingId);
    if (!this.canReschedule(booking, new Date())) {
      throw new RescheduleNotAllowedError('La cita ya no se puede reagendar');
    }
    await bookings(this.db).updateOne(
      { _id: bookingId },
      { $set: { datetime, 'metadata.originalDatetime': booking.metadata.originalDatetime ?? booking.datetime } },
    );
    return this.get(bookingId);
  }

  /** Política estable: se reagenda con más de 24 h de anticipación. */
  canReschedule(booking: Booking, now: Date): boolean {
    if (booking.status !== 'paid' || !booking.datetime) return false;
    return booking.datetime.getTime() - now.getTime() > RESCHEDULE_HOURS_NOTICE * HOUR;
  }

  async get(bookingId: string) {
    return this.bookingSerializer(await this.findOrThrow(bookingId));
  }

  /**
   * Toda respuesta pasa por acá, así que effectiveVariant sale siempre, sin depender de cada handler.
   * Si el experimento del booking ya no es el activo (cerró, o se apagó con el kill switch), vale 'stable'.
   */
  async bookingSerializer(booking: Booking): Promise<SerializedBooking> {
    const active = await this.experiments.getActive();
    const stillRunning = booking.experimentId !== undefined && booking.experimentId === active?.experimentId;
    return { ...booking, effectiveVariant: stillRunning ? (booking.experimentVariant ?? 'stable') : 'stable' };
  }

  /** Escritura condicional y atómica: solo asigna si el booking todavía no tiene experimento. */
  async assignVariant(bookingId: string, email: string) {
    const { experimentId, variant } = await this.experiments.resolve(email);
    if (!experimentId) return;
    await bookings(this.db).updateOne(
      { _id: bookingId, experimentId: { $exists: false } },
      { $set: { experimentId, experimentVariant: variant } },
    );
  }

  async findOrThrow(bookingId: string) {
    const booking = await bookings(this.db).findOne({ _id: bookingId });
    if (!booking) throw new NotFoundError(`Booking ${bookingId} no encontrado`);
    return booking;
  }
}
