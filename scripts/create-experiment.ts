// npm run experiment:create -- --id=reagendamiento-flexible --description="..." [--split=50] [--confirm]
import { MongoServerError } from 'mongodb';
import { ExperimentService } from '../src/experiment.service.ts';
import { arg, flag, withDb } from './cli.ts';

const experimentId = arg('id');
const description = arg('description');
const splitPercentage = Number(arg('split') ?? 50);

if (!experimentId || !description) {
  console.error('Uso: --id=<experimentId> --description="<qué se prueba>" [--split=50] [--confirm]');
  process.exit(1);
}

await withDb(async (db) => {
  const service = new ExperimentService(db);
  const active = await service.getActive();
  console.log(active ? `Experimento activo: ${active.experimentId}` : 'No hay experimento activo.');

  if (!flag('confirm')) {
    console.log(`\nDry-run: crearía "${experimentId}" con split ${splitPercentage}% a testing. Agregar --confirm.`);
    return;
  }
  try {
    console.log('\nExperimento creado:', await service.create({ experimentId, description, splitPercentage }));
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) {
      console.error('\nRechazado por la base de datos: ya hay un experimento activo (o el id ya existe). Cerralo primero.');
      process.exitCode = 1;
      return;
    }
    throw err;
  }
});
