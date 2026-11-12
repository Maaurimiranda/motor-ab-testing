import { MongoClient, type Db } from 'mongodb';
import type { Booking, Experiment } from './models.ts';

export const experiments = (db: Db) => db.collection<Experiment>('experiments');
export const bookings = (db: Db) => db.collection<Booking>('bookings');

export async function connect(uri: string, dbName = 'motor_ab_testing') {
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  await ensureIndexes(db);
  return { client, db };
}

export async function ensureIndexes(db: Db) {
  // Un único experimento activo, garantizado por la base de datos y no por el código:
  // el índice solo contiene documentos con active: true, y es único.
  await experiments(db).createIndex(
    { active: 1 },
    { unique: true, partialFilterExpression: { active: true }, name: 'un_solo_experimento_activo' },
  );
  await experiments(db).createIndex({ experimentId: 1 }, { unique: true });
}
