# Motor de A/B testing para un wizard de reserva de turnos

Infraestructura para correr experimentos A/B sobre un flujo de alto tráfico sin poner en riesgo el flujo que ya funciona: separa el código estable del de prueba, asigna cada paciente a una variante de forma determinística, registra qué versión vio cada una, y permite apagar o cerrar un experimento sin deploy.

## Origen

Este repositorio acompaña mi **Práctica Profesional Supervisada** (Ingeniería en Sistemas de Información, UTN FRM, 2026). Durante la práctica construí este motor sobre el wizard de agendamiento de una plataforma de salud en producción. Por confidencialidad, el código de la organización no puede publicarse: describe su infraestructura y es parte de un sistema con datos de salud.

Con autorización de la dirección, acá reimplementé **la misma lógica** sobre un dominio genérico de reserva de turnos y sin dependencias de esa infraestructura. Incluye los tres trabajos de la práctica: el motor y los dos experimentos que corrieron sobre él (anticipación de exámenes y filtro de categorías clínicas), cada uno con su ciclo completo en el historial de Git. Los nombres de las piezas (`BookingStableService`, `BookingTestingService`, `getBookingService`, `effectiveVariant`, la colección `experiments`, `searchSpecialistsV2`, `matchType`) son los mismos que se usan en el informe.

## Probarlo en 5 minutos

Requiere Node 22.18 o superior (corre TypeScript sin compilar) y, para la API y los scripts, Docker.

```bash
npm install
npm test            # 21 tests contra un MongoDB real en memoria, sin Docker
```

Recorrido completo de un experimento:

```bash
docker compose up -d                                   # MongoDB en localhost:27017
npm run seed                                           # profesionales ficticias con categorías
npm run experiment:create -- --id=control-aa --description="Control A/A" --split=50 --confirm
npm run experiment:create -- --id=otro --description="otro" --confirm   # la base lo rechaza: ya hay uno activo
npm run simulate -- --patients=1000                    # 1000 pacientes sintéticas recorren el wizard
npm run report                                         # conversión por variante, z-test, balance, asignación fija
npm run experiment:close -- --confirm --reason=kill-switch
```

La API (`npm start`, puerto 3000):

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/bookings` | Inicia una reserva (`{ "email"? }`) |
| `POST` | `/bookings/:id/start` | Identifica a la paciente (`{ "email" }`) y le asigna variante |
| `GET` | `/bookings/:id/specialists/search` | Grilla de profesionales (búsqueda original, intacta) |
| `GET` | `/bookings/:id/specialists/search-v2?categories=a,b` | Filtro de categorías clínicas, con `matchType` |
| `POST` | `/bookings/:id/exams-acknowledgement` | Consentimiento del aviso de exámenes |
| `POST` | `/bookings/:id/slot` | Elige fecha y hora (`{ "datetime" }`) |
| `POST` | `/bookings/:id/pay` | Paga: la conversión |
| `POST` | `/bookings/:id/reschedule` | Reagenda (`{ "datetime" }`) |
| `GET` | `/bookings/:id` | Devuelve la reserva con su `effectiveVariant` |
| `PUT` | `/professionals/:id/specialty-categories` | Carga las categorías de una ginecóloga |

## Cómo funciona

```
request ──► getBookingService(bookingId) ──┬──► BookingStableService      (flujo estable, no se toca)
            lee en paralelo:                └──► BookingTestingService     (extends Stable, sobrescribe
            booking + experimento activo                                   solo lo que cambia el experimento)
                                                     │
                                                     ▼
                                            bookingSerializer ──► respuesta con effectiveVariant
```

| Requerimiento | Dónde | Cómo |
|---|---|---|
| Asignación fija y determinística | `src/experiment.service.ts` | `hash(experimentId:email) % 100 < splitPercentage`. Misma paciente, misma variante; con cada experimento nuevo se re-randomiza. |
| Registro del experimento y la variante | `assignVariant` en `src/bookings/stable.service.ts` | `experimentId` + `experimentVariant` en el booking, escritos con una actualización condicional atómica (solo si todavía no tiene). |
| Un único experimento activo | `src/db.ts` | Índice único parcial sobre `{ active: true }`. Lo garantiza la base, no el código. |
| Flujo estable intacto | `src/bookings/testing.service.ts` | Herencia: la variante de prueba sobrescribe un método y hereda el resto. |
| Un solo punto de decisión | `src/bookings/factory.ts` | Los handlers nunca hacen `new`. Usa testing solo si el experimento del booking es el activo. |
| Variante efectiva en toda respuesta | `bookingSerializer` | Se recalcula siempre: vuelve a `stable` apenas el experimento se cierra. El campo histórico no se toca. |
| Kill switch sin deploy | `scripts/close-active-experiment.ts` | `active: false` con `--reason=kill-switch`. Dry-run por defecto. |
| Medición | `scripts/report.ts`, `src/stats.ts` | Conversión por paciente, z-test de dos proporciones, balance contra el split y control de asignación fija. |

### Los experimentos de la práctica, en el historial

Cada experimento entra como cambio en `BookingTestingService` (el estable no se toca) y sale con un commit de cierre que lo promueve. Recorrer el historial muestra el ciclo completo:

```bash
git log --oneline
git show <commit>        # el diff de cada etapa
```

| Etapa | Commit | Qué cambia |
|---|---|---|
| Motor | `feat: motor de A/B testing…` | Infraestructura; `BookingTestingService` vacía = control A/A |
| Anticipación de exámenes, en prueba | `feat(anticipacion): …` | La variante suma el consentimiento de exámenes (`examsAcknowledgedAt`) y deja reagendar citas compradas con menos de 24 h. El endpoint de exámenes responde 404 fuera de `testing` |
| Anticipación de exámenes, cierre | `chore(anticipacion): …` | Ganó: los métodos pasan al estable y la clase de prueba vuelve a quedar vacía |
| Grilla base | `feat: grilla de profesionales…` | Búsqueda original de profesionales en el estable |
| Filtro de categorías, en prueba | `feat(filtro): …` | `searchSpecialistsV2`: coincidencia total → parcial ordenada → ninguna (`matchType`). La búsqueda original no cambia (test de regresión) |
| Filtro de categorías, cierre | `chore(filtro): …` | Ganó: se promueve al estable y la clase de prueba vuelve a quedar vacía |

**Cierre disciplinado:** si la variante gana, sus métodos pasan a `BookingStableService` y la clase de prueba queda vacía; si pierde, se borran sin tocar el estable. Nunca conviven más de dos versiones. Hoy `BookingTestingService` está vacía, lista para el próximo experimento.

### El bug que encontró el control A/A

En la implementación original, la función de hash elevaba el valor al cuadrado antes del módulo 100. Los cuadrados módulo 100 solo alcanzan **22 de los 100 buckets**, con un reparto de 64/36 alrededor de 50: el split nunca podía ser 50/50. El control con dos versiones idénticas lo detectó, porque la proporción en `testing` se quedaba en 53-54 % y no convergía al crecer la muestra. `test/hash.test.ts` deja el bug documentado como test de regresión.

## Fuera de alcance

- **Frontend.** En la práctica, el wizard (Angular + Ionic) elegía la página estable o la de prueba con guards `canMatch` leyendo `effectiveVariant`. Acá la API expone ese mismo campo.
- **Más de dos variantes**, reglas de targeting e interfaz de administración del kill switch.
- **Eventos de analítica.** La medición sale de los bookings.

## Estructura

```
src/
  models.ts                 schemas de experimento y booking
  db.ts                     colecciones e índices
  hash.ts                   hash de asignación
  experiment.service.ts     resolver de variante y ciclo de vida del experimento
  professional.service.ts   carga de categorías clínicas
  bookings/
    stable.service.ts       flujo estable + bookingSerializer + experimentos promovidos
    testing.service.ts      variante de prueba (hoy vacía)
    factory.ts              getBookingService
  stats.ts                  z-test y balance
  app.ts, server.ts         API
scripts/                    crear, cerrar (kill switch), simular, reportar, datos de prueba
test/                       tests con MongoDB en memoria
```

## Licencia

MIT — Mauricio Alen Miranda
