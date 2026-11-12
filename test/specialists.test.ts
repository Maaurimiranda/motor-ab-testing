import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BookingStableService } from '../src/bookings/stable.service.ts';
import { BookingTestingService } from '../src/bookings/testing.service.ts';
import { professionals } from '../src/db.ts';
import { setSpecialtyCategories } from '../src/professional.service.ts';
import { useDb } from './helpers.ts';

const ctx = useDb();
const seed = () =>
  professionals(ctx.db).insertMany([
    { _id: 'c', name: 'Carla', specialtyType: 'gynecology', specialtyCategories: ['Salud Sexual'] },
    { _id: 'a', name: 'Ana', specialtyType: 'gynecology', specialtyCategories: ['Salud Sexual', 'Piso Pélvico'] },
    { _id: 'b', name: 'Bea', specialtyType: 'gynecology', specialtyCategories: ['Piso Pélvico'] },
    { _id: 'e', name: 'Elena', specialtyType: 'gynecology' }, // sin categorías
    { _id: 'n', name: 'Nora', specialtyType: 'nutrition' },
  ]);
const ids = (ps: { _id: string }[]) => ps.map((p) => p._id);

async function search(categories: Parameters<BookingTestingService['searchSpecialistsV2']>[1]) {
  const service = new BookingTestingService(ctx.db);
  const { _id } = await service.init();
  const result = await service.searchSpecialistsV2(_id, categories);
  return { matchType: result.matchType, ids: ids(result.specialists) };
}

test('regresión: la búsqueda original sigue devolviendo todas las ginecólogas, sin cambios', async () => {
  await seed();
  const stable = new BookingStableService(ctx.db);
  const { _id } = await stable.init();
  assert.deepEqual(ids(await stable.searchSpecialists(_id)), ['a', 'b', 'c', 'e']);
});

test('filtro: coincidencia total, parcial ordenada por coincidencias, ninguna y "Todas"', async () => {
  await seed();
  assert.deepEqual(await search(['Salud Sexual', 'Piso Pélvico']), { matchType: 'exact', ids: ['a'] });
  assert.deepEqual(await search(['Salud Sexual']), { matchType: 'exact', ids: ['a', 'c'] });
  assert.deepEqual(await search(['Salud Sexual', 'Piso Pélvico', 'Salud Mental y Bienestar']), {
    matchType: 'partial',
    ids: ['a', 'b', 'c'], // Ana coincide en 2; Bea y Carla en 1, por nombre
  });
  assert.deepEqual(await search(['Antecedentes Mamarios u Oncológicos']), { matchType: 'none', ids: [] });
  assert.deepEqual(await search([]), { matchType: 'exact', ids: ['a', 'b', 'c', 'e'] }); // la sin categorías solo acá
});

test('carga de categorías: rechaza valores fuera del enum y no aplica a nutricionistas', async () => {
  await seed();
  assert.deepEqual((await setSpecialtyCategories(ctx.db, 'e', ['Piso Pélvico'])).specialtyCategories, ['Piso Pélvico']);
  await assert.rejects(setSpecialtyCategories(ctx.db, 'e', ['Cardiología']));
  await assert.rejects(setSpecialtyCategories(ctx.db, 'n', ['Piso Pélvico']));
});
