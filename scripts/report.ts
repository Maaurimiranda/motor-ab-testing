// npm run report -- [--id=<experimentId>]   (por defecto, el activo o el último cerrado)
// Conversión = booking pagado. Unidad de análisis: la paciente, en la variante de su primer booking.
import { bookings, experiments } from '../src/db.ts';
import { balanceTest, twoProportionZTest } from '../src/stats.ts';
import { arg, withDb } from './cli.ts';

const pct = (x: number) => `${(100 * x).toFixed(1)} %`;

await withDb(async (db) => {
  const id = arg('id');
  const experiment = id
    ? await experiments(db).findOne({ experimentId: id })
    : ((await experiments(db).findOne({ active: true })) ??
      (await experiments(db).find().sort({ endedAt: -1 }).limit(1).next()));
  if (!experiment) {
    console.error('No se encontró el experimento.');
    process.exitCode = 1;
    return;
  }

  const rows = await bookings(db)
    .find({ experimentId: experiment.experimentId, email: { $exists: true } })
    .sort({ createdAt: 1 })
    .toArray();

  const patients = new Map<string, { variant: string; variants: Set<string>; paid: boolean }>();
  for (const b of rows) {
    const p = patients.get(b.email!) ?? { variant: b.experimentVariant!, variants: new Set(), paid: false };
    p.variants.add(b.experimentVariant!);
    p.paid ||= b.status === 'paid';
    patients.set(b.email!, p);
  }

  const count = (variant: string) => {
    const ps = [...patients.values()].filter((p) => p.variant === variant);
    return { n: ps.length, paid: ps.filter((p) => p.paid).length };
  };
  const s = count('stable');
  const t = count('testing');
  const conversion = twoProportionZTest(s.paid, s.n, t.paid, t.n);
  const balance = balanceTest(t.n, s.n + t.n, experiment.bucketingData.splitPercentage / 100);

  console.log(`\nExperimento: ${experiment.experimentId} — ${experiment.description}`);
  console.log(`Estado: ${experiment.active ? 'activo' : `cerrado (${experiment.endedReason})`}, split ${experiment.bucketingData.splitPercentage}% a testing`);
  console.table({
    stable: { pacientes: s.n, convertidas: s.paid, conversion: pct(conversion.p1) },
    testing: { pacientes: t.n, convertidas: t.paid, conversion: pct(conversion.p2) },
  });
  console.log(`Diferencia testing − stable: ${(100 * conversion.diff).toFixed(1)} pp, z = ${conversion.z.toFixed(2)}, p = ${conversion.pValue.toFixed(3)}`);
  console.log(conversion.pValue < 0.05 ? '→ Diferencia significativa (α = 0,05).' : '→ Sin diferencia significativa (α = 0,05).');
  console.log(`Balance: ${pct(balance.share)} en testing, p = ${balance.pValue.toFixed(3)} contra el split configurado.`);
  const crossed = [...patients.values()].filter((p) => p.variants.size > 1).length;
  const retried = rows.length - patients.size;
  console.log(`Asignación fija: ${crossed} pacientes con más de una variante (${retried} bookings repetidos).`);
});
