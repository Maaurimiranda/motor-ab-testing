import { after, before, beforeEach } from 'node:test';
import { MongoClient, type Db } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ensureIndexes } from '../src/db.ts';

/** MongoDB real en memoria: el índice único parcial es una garantía de la base, hay que probarla contra una. */
export function useDb() {
  const ctx = {} as { db: Db };
  let server: MongoMemoryServer;
  let client: MongoClient;

  before(async () => {
    server = await MongoMemoryServer.create();
    client = await MongoClient.connect(server.getUri());
    ctx.db = client.db('test');
    await ensureIndexes(ctx.db);
  });
  beforeEach(async () => {
    await ctx.db.collection('bookings').deleteMany({});
    await ctx.db.collection('experiments').deleteMany({});
  });
  after(async () => {
    await client.close();
    await server.stop();
  });

  return ctx;
}
