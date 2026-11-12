import { z } from 'zod';

export type Variant = 'stable' | 'testing';

export const PercentageBucketingDataSchema = z.object({
  splitPercentage: z.number().min(0).max(100),
});

// Patrón tipo + datos del tipo: sumar otra forma de bucketing es agregar un literal a bucketingType
// y convertir bucketingData en z.union([...]), sin tocar el resto. Mongo no guarda clases, guarda datos.
export const ExperimentSchema = z.object({
  experimentId: z.string().min(1),
  description: z.string().min(1), // qué se prueba, legible sin mirar el código (que se borra al cerrar)
  active: z.boolean(),
  bucketingType: z.literal('percentage'),
  bucketingData: PercentageBucketingDataSchema,
  startedAt: z.date(),
  endedAt: z.date().optional(),
  endedReason: z.enum(['normal-closure', 'kill-switch']).optional(),
});

export type Experiment = z.infer<typeof ExperimentSchema>;
export type EndedReason = NonNullable<Experiment['endedReason']>;

export type BookingStatus = 'started' | 'slot-selected' | 'paid' | 'cancelled';

export interface Booking {
  _id: string;
  email?: string;
  status: BookingStatus;
  createdAt: Date;
  datetime?: Date;
  // Registro histórico: nunca se pisa. El frontend no lo lee; lee effectiveVariant.
  experimentId?: string;
  experimentVariant?: Variant;
  metadata: { originalDatetime?: Date; paidAt?: Date };
}

export type SerializedBooking = Booking & { effectiveVariant: Variant };
