import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BookingStableService } from '../src/bookings/stable.service.ts';
import { professionals } from '../src/db.ts';
import { useDb } from './helpers.ts';

const ctx = useDb();
const seed = () =>
  professionals(ctx.db).insertMany([
    { _id: 'c', name: 'Carla', specialtyType: 'gynecology' },
    { _id: 'a', name: 'Ana', specialtyType: 'gynecology' },
    { _id: 'n', name: 'Nora', specialtyType: 'nutrition' },
  ]);

test('la grilla devuelve solo ginecólogas, ordenadas por nombre', async () => {
  await seed();
  const stable = new BookingStableService(ctx.db);
  const { _id } = await stable.init();
  assert.deepEqual((await stable.searchSpecialists(_id)).map((p) => p._id), ['a', 'c']);
});
