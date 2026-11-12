import express, { type ErrorRequestHandler } from 'express';
import type { Db } from 'mongodb';
import { z } from 'zod';
import { getBookingService } from './bookings/factory.ts';
import { BookingStableService, NotFoundError, RescheduleNotAllowedError } from './bookings/stable.service.ts';

const EmailBody = z.object({ email: z.string().email() });
const OptionalEmailBody = z.object({ email: z.string().email().optional() });
const DatetimeBody = z.object({ datetime: z.coerce.date() });

export function createApp(db: Db) {
  const app = express();
  app.use(express.json());

  // Todavía no hay booking, así que no hay variante que resolver: lo crea el flujo estable.
  app.post('/bookings', async (req, res) => {
    const { email } = OptionalEmailBody.parse(req.body ?? {});
    res.status(201).json(await new BookingStableService(db).init(email));
  });

  app.get('/bookings/:id', async (req, res) => {
    const service = await getBookingService(db, req.params.id);
    res.json(await service.get(req.params.id));
  });

  app.post('/bookings/:id/start', async (req, res) => {
    const { email } = EmailBody.parse(req.body);
    const service = await getBookingService(db, req.params.id);
    res.json(await service.start(req.params.id, email));
  });

  app.post('/bookings/:id/slot', async (req, res) => {
    const { datetime } = DatetimeBody.parse(req.body);
    const service = await getBookingService(db, req.params.id);
    res.json(await service.selectSlot(req.params.id, datetime));
  });

  app.post('/bookings/:id/pay', async (req, res) => {
    const service = await getBookingService(db, req.params.id);
    res.json(await service.pay(req.params.id));
  });

  app.post('/bookings/:id/exams-acknowledgement', async (req, res) => {
    const service = await getBookingService(db, req.params.id);
    res.json(await service.acknowledgeExams(req.params.id));
  });

  app.post('/bookings/:id/reschedule', async (req, res) => {
    const { datetime } = DatetimeBody.parse(req.body);
    const service = await getBookingService(db, req.params.id);
    res.json(await service.reschedule(req.params.id, datetime));
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof z.ZodError) return void res.status(400).json({ error: err.issues });
    if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
    if (err instanceof RescheduleNotAllowedError) return void res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  };
  app.use(onError);

  return app;
}
