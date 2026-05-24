import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/couple_food_picker';

await mongoose.connect(mongoUri, {
  autoIndex: true,
});

const stateSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, index: true },
    key: { type: String, required: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
  },
);

stateSchema.index({ clientId: 1, key: 1 }, { unique: true });

const State = mongoose.model('State', stateSchema);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/state/:key', async (req, res) => {
  const { key } = req.params;
  const { clientId } = req.query;
  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }
  const doc = await State.findOne({ clientId, key }).lean();
  if (!doc) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.json(doc);
});

app.put('/api/state/:key', async (req, res) => {
  const { key } = req.params;
  const { clientId, value } = req.body || {};
  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }
  const doc = await State.findOneAndUpdate(
    { clientId, key },
    { $set: { value } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return res.json(doc);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, '..', 'dist');

app.use(express.static(distDir));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.method === 'GET' && req.accepts('html')) {
    return res.sendFile(path.join(distDir, 'index.html'));
  }
  return next();
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`API server listening on http://localhost:${port}`);
});
