// npm run seed -- carga profesionales ficticias para probar la grilla y el filtro del wizard.
import { professionals } from '../src/db.ts';
import type { Professional } from '../src/models.ts';
import { withDb } from './cli.ts';

const seed: Professional[] = [
  { _id: 'p1', name: 'Dra. Ana Acosta', specialtyType: 'gynecology', specialtyCategories: ['Endocrinología Ginecológica', 'Salud Sexual'] },
  { _id: 'p2', name: 'Dra. Beatriz Benítez', specialtyType: 'gynecology', specialtyCategories: ['Endocrinología Ginecológica'] },
  { _id: 'p3', name: 'Dra. Carla Castro', specialtyType: 'gynecology', specialtyCategories: ['Salud Mental y Bienestar'] },
  { _id: 'p4', name: 'Dra. Diana Díaz', specialtyType: 'gynecology', specialtyCategories: ['Piso Pélvico', 'Salud Sexual'] },
  { _id: 'p5', name: 'Dra. Elena Estévez', specialtyType: 'gynecology' }, // sin categorías: solo aparece en "Todas"
  { _id: 'p6', name: 'Lic. Florencia Funes', specialtyType: 'nutrition' },
];

await withDb(async (db) => {
  for (const p of seed) await professionals(db).replaceOne({ _id: p._id }, p, { upsert: true });
  console.log(`${seed.length} profesionales cargadas.`);
});
