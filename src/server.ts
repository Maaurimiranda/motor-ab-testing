import { createApp } from './app.ts';
import { connect } from './db.ts';

const { db } = await connect(process.env.MONGO_URL ?? 'mongodb://localhost:27017');
const port = Number(process.env.PORT ?? 3000);
createApp(db).listen(port, () => console.log(`API escuchando en http://localhost:${port}`));
