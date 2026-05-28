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
    coupleId: { type: String, index: true },
  },
  { timestamps: true },
);

stateSchema.index({ clientId: 1, key: 1 }, { unique: true });
stateSchema.index({ coupleId: 1, key: 1 });

const State = mongoose.model('State', stateSchema);

const coupleSchema = new mongoose.Schema(
  {
    coupleId: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    member1: { type: String, required: true },
    member2: { type: String },
  },
  { timestamps: true },
);

const Couple = mongoose.model('Couple', coupleSchema);

// --- API Router (all /api/* routes) ---
const api = express.Router();
api.use(cors());
api.use(express.json({ limit: '2mb' }));

api.get('/health', (_req, res) => {
  res.json({ ok: true });
});

api.get('/state/:key', async (req, res) => {
  const { key } = req.params;
  const { clientId } = req.query;
  if (!clientId) return res.status(400).json({ error: 'clientId is required' });
  const doc = await State.findOne({ clientId, key }).lean();
  if (!doc) return res.status(404).json({ error: 'Not found' });
  return res.json(doc);
});

api.put('/state/:key', async (req, res) => {
  const { key } = req.params;
  const { clientId, value } = req.body || {};
  if (!clientId) return res.status(400).json({ error: 'clientId is required' });
  const doc = await State.findOneAndUpdate(
    { clientId, key },
    { $set: { value } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return res.json(doc);
});

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

api.post('/couple/create', async (req, res) => {
  const { clientId } = req.body || {};
  if (!clientId) return res.status(400).json({ error: 'clientId is required' });
  const existing = await Couple.findOne({ $or: [{ member1: clientId }, { member2: clientId }] });
  if (existing) return res.json({ coupleId: existing.coupleId, code: existing.code, member1: existing.member1, member2: existing.member2 || null });
  const coupleId = `cpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let code = generateCode();
  for (let attempt = 0; attempt < 10; attempt++) {
    const conflict = await Couple.findOne({ code });
    if (!conflict) break;
    code = generateCode();
  }
  const doc = await Couple.create({ coupleId, code, member1: clientId, member2: null });
  return res.json({ coupleId: doc.coupleId, code: doc.code, member1: doc.member1, member2: null });
});

api.post('/couple/join', async (req, res) => {
  const { code, clientId } = req.body || {};
  if (!code || !clientId) return res.status(400).json({ error: 'code and clientId are required' });
  const doc = await Couple.findOne({ code });
  if (!doc) return res.status(404).json({ error: 'Invalid code' });
  if (doc.member1 === clientId) return res.json({ coupleId: doc.coupleId, code: doc.code, member1: doc.member1, member2: doc.member2, partnerId: doc.member2, partnerJoined: !!doc.member2 });
  if (doc.member2) return res.status(409).json({ error: 'Couple already has two members' });
  doc.member2 = clientId;
  await doc.save();
  return res.json({ coupleId: doc.coupleId, code: doc.code, member1: doc.member1, member2: clientId });
});

api.get('/couple/status', async (req, res) => {
  const { clientId } = req.query;
  if (!clientId) return res.status(400).json({ error: 'clientId is required' });
  const doc = await Couple.findOne({ $or: [{ member1: clientId }, { member2: clientId }] });
  if (!doc) return res.json({ bound: false });
  return res.json({ bound: true, coupleId: doc.coupleId, code: doc.code, partnerId: doc.member1 === clientId ? doc.member2 : doc.member1, partnerJoined: !!doc.member2 });
});

api.get('/couple-state/:coupleId/:key', async (req, res) => {
  const { coupleId, key } = req.params;
  const doc = await State.findOne({ coupleId, key }).lean();
  if (!doc) return res.json({ coupleId, key, value: null, updatedAt: null });
  const updatedAt = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
  return res.json({ coupleId, key, value: doc.value, updatedAt });
});

api.put('/couple-state/:coupleId/:key', async (req, res) => {
  const { coupleId, key } = req.params;
  const { value } = req.body || {};
  if (value === undefined) return res.status(400).json({ error: 'value is required' });
  const doc = await State.findOneAndUpdate(
    { coupleId, key },
    { $set: { value, coupleId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return res.json(doc);
});

app.use('/api', api);

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