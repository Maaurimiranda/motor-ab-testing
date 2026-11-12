import { connect } from '../src/db.ts';

export const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
export const flag = (name: string) => process.argv.includes(`--${name}`);

/** Conecta, corre el script y cierra la conexión pase lo que pase. */
export async function withDb(fn: (db: Awaited<ReturnType<typeof connect>>['db']) => Promise<void>) {
  const { client, db } = await connect(process.env.MONGO_URL ?? 'mongodb://localhost:27017');
  try {
    await fn(db);
  } finally {
    await client.close();
  }
}
