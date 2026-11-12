// npm run experiment:close -- [--confirm] [--reason=normal-closure|kill-switch]
// Cierra el experimento activo (el que sea). Dry-run por defecto.
// Kill switch = este mismo cierre con --reason=kill-switch: sin deploy, todo el tráfico vuelve
// al flujo estable, y los bookings en curso reciben effectiveVariant 'stable' en su próxima respuesta.
import { ExperimentService } from '../src/experiment.service.ts';
import type { EndedReason } from '../src/models.ts';
import { arg, flag, withDb } from './cli.ts';

const reason = (arg('reason') ?? 'normal-closure') as EndedReason;
if (reason !== 'normal-closure' && reason !== 'kill-switch') {
  console.error('--reason debe ser normal-closure o kill-switch');
  process.exit(1);
}

await withDb(async (db) => {
  const service = new ExperimentService(db);
  const active = await service.getActive();
  if (!active) {
    console.log('No hay ningún experimento activo. Nada que hacer.');
    return;
  }
  console.log('Experimento activo:', active);
  if (!flag('confirm')) {
    console.log(`\nDry-run: correr de nuevo con --confirm para cerrarlo (endedReason: ${reason}).`);
    return;
  }
  console.log('\nExperimento cerrado:', await service.closeActive(reason));
});
