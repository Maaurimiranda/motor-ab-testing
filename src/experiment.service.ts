import type { Db } from 'mongodb';
import { experiments } from './db.ts';
import { hashCode } from './hash.ts';
import { ExperimentSchema, type EndedReason, type Experiment, type Variant } from './models.ts';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Determinística: misma combinación experimento + email, misma variante, siempre.
 * Mezclar el experimentId en el hash re-randomiza a cada paciente en cada experimento nuevo.
 */
export function computeVariant(
  experiment: Pick<Experiment, 'experimentId' | 'bucketingType' | 'bucketingData'>,
  email: string,
): Variant {
  switch (experiment.bucketingType) {
    case 'percentage': {
      const bucket = hashCode(`${experiment.experimentId}:${normalizeEmail(email)}`) % 100;
      return bucket < experiment.bucketingData.splitPercentage ? 'testing' : 'stable';
    }
    default:
      throw new Error('bucketingType desconocido');
  }
}

export class ExperimentService {
  db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  getActive() {
    return experiments(this.db).findOne({ active: true });
  }

  async resolve(email: string): Promise<{ experimentId: string | null; variant: Variant }> {
    const active = await this.getActive();
    if (!active) return { experimentId: null, variant: 'stable' };
    return { experimentId: active.experimentId, variant: computeVariant(active, email) };
  }

  /** Falla con error de clave duplicada (11000) si ya hay un experimento activo. */
  async create(input: { experimentId: string; description: string; splitPercentage: number }) {
    const experiment = ExperimentSchema.parse({
      experimentId: input.experimentId,
      description: input.description,
      active: true,
      bucketingType: 'percentage',
      bucketingData: { splitPercentage: input.splitPercentage },
      startedAt: new Date(),
    });
    await experiments(this.db).insertOne({ ...experiment });
    return experiment;
  }

  /** Cierre normal y kill switch son la misma operación; solo cambia el motivo registrado. */
  closeActive(reason: EndedReason) {
    return experiments(this.db).findOneAndUpdate(
      { active: true },
      { $set: { active: false, endedAt: new Date(), endedReason: reason } },
      { returnDocument: 'after' },
    );
  }
}
