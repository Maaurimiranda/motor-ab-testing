import type { Db } from 'mongodb';
import { z } from 'zod';
import { NotFoundError } from './bookings/stable.service.ts';
import { professionals } from './db.ts';
import { SpecialtyCategorySchema } from './models.ts';

/**
 * Carga de categorías sin panel de administración: la usa la herramienta interna del equipo
 * y el perfil de cada profesional. Solo actualiza el campo enviado.
 */
export async function setSpecialtyCategories(db: Db, professionalId: string, categories: unknown) {
  const parsed = z.array(SpecialtyCategorySchema).parse(categories);
  const updated = await professionals(db).findOneAndUpdate(
    { _id: professionalId, specialtyType: 'gynecology' },
    { $set: { specialtyCategories: [...new Set(parsed)] } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new NotFoundError(`Ginecóloga ${professionalId} no encontrada`);
  return updated;
}
