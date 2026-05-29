import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

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

const pushSubscriptionSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, index: true },
    coupleId: { type: String, index: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true },
);

pushSubscriptionSchema.index({ clientId: 1, endpoint: 1 }, { unique: true });

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidContact = process.env.VAPID_CONTACT || 'mailto:owner@example.com';
const vapidConfigured = Boolean(vapidPublicKey && vapidPrivateKey);
if (vapidConfigured) {
  webpush.setVapidDetails(vapidContact, vapidPublicKey, vapidPrivateKey);
}

const pokeRateLimit = new Map();
const POKE_INTERVAL_MS = 30_000;

const nearbyCategories = new Map([
  ['main', '正餐'],
  ['drinks', '茶饮'],
  ['coffee', '咖啡'],
  ['cake', '蛋糕'],
  ['snacks', '小吃'],
]);
const poiProvider = process.env.MAP_POI_PROVIDER || 'mock';
const poiApiKey = process.env.MAP_POI_API_KEY || '';
const amapTypeCodes = {
  main: '050000',
  drinks: '050700',
  coffee: '050500',
  cake: '050800',
  snacks: '050900',
};
const tencentCategoryKeywords = {
  main: '餐厅',
  drinks: '奶茶',
  coffee: '咖啡',
  cake: '蛋糕',
  snacks: '小吃',
};

function parseNumberParam(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNearbyFoodQuery(query) {
  const lat = parseNumberParam(query.lat);
  const lng = parseNumberParam(query.lng);
  const category = query.category || 'main';
  const radius = parseNumberParam(query.radius, 1500);
  const limit = parseNumberParam(query.limit, 20);

  if (typeof lat !== 'number' || lat < -90 || lat > 90) return { error: 'lat must be a number between -90 and 90' };
  if (typeof lng !== 'number' || lng < -180 || lng > 180) return { error: 'lng must be a number between -180 and 180' };
  if (!nearbyCategories.has(category)) return { error: 'category is invalid' };
  if (radius === null || radius <= 0) return { error: 'radius must be a positive number' };
  if (limit === null || limit <= 0) return { error: 'limit must be a positive number' };

  return {
    lat,
    lng,
    category,
    radius: Math.min(Math.round(radius), 5000),
    limit: Math.min(Math.round(limit), 30),
  };
}

function normalizePoi(item, category, source) {
  return {
    id: String(item.id || `${source}-${item.name}-${item.lat}-${item.lng}`),
    name: String(item.name || ''),
    category,
    categoryLabel: nearbyCategories.get(category),
    address: item.address ? String(item.address) : '',
    distance: Number.isFinite(Number(item.distance)) ? Math.round(Number(item.distance)) : null,
    lat: Number.isFinite(Number(item.lat)) ? Number(item.lat) : null,
    lng: Number.isFinite(Number(item.lng)) ? Number(item.lng) : null,
    source,
  };
}

function withTimeout(ms = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

function parseAmapLocation(location) {
  if (typeof location !== 'string') return {};
  const [lng, lat] = location.split(',').map(Number);
  return { lat, lng };
}

function normalizeAmapPoi(item) {
  const location = parseAmapLocation(item.location);
  return {
    id: item.id,
    name: item.name,
    address: Array.isArray(item.address) ? item.address.join('') : item.address,
    distance: item.distance,
    lat: location.lat,
    lng: location.lng,
  };
}

function normalizeTencentPoi(item) {
  return {
    id: item.id,
    name: item.title,
    address: item.address,
    distance: item._distance,
    lat: item.location?.lat,
    lng: item.location?.lng,
  };
}

async function fetchAmapNearbyFood({ lat, lng, category, radius, limit }) {
  const url = new URL('https://restapi.amap.com/v5/place/around');
  url.search = new URLSearchParams({
    key: poiApiKey,
    location: `${lng},${lat}`,
    radius: String(radius),
    types: amapTypeCodes[category],
    page_size: String(limit),
  });

  const { controller, timer } = withTimeout();
  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json();
    if (!response.ok || data.status !== '1') {
      const error = new Error(data.info || 'Map POI provider request failed');
      error.status = response.ok ? 502 : response.status;
      throw error;
    }
    return (data.pois || []).map(normalizeAmapPoi);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTencentNearbyFood({ lat, lng, category, radius, limit }) {
  const url = new URL('https://apis.map.qq.com/ws/place/v1/search');
  url.search = new URLSearchParams({
    key: poiApiKey,
    keyword: tencentCategoryKeywords[category],
    boundary: `nearby(${lat},${lng},${radius},1)`,
    page_size: String(limit),
  });

  const { controller, timer } = withTimeout();
  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json();
    if (!response.ok || data.status !== 0) {
      const error = new Error(data.message || 'Map POI provider request failed');
      error.status = response.ok ? 502 : response.status;
      throw error;
    }
    return (data.data || []).map(normalizeTencentPoi);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchNearbyFoodFromProvider(params) {
  if (poiProvider === 'mock' || !poiApiKey) {
    const error = new Error('Map POI provider is not configured');
    error.status = 503;
    throw error;
  }

  if (poiProvider === 'amap') return fetchAmapNearbyFood(params);
  if (poiProvider === 'tencent') return fetchTencentNearbyFood(params);

  const error = new Error('Map POI provider is not supported');
  error.status = 503;
  throw error;
}

// --- API Router (all /api/* routes) ---
const api = express.Router();
api.use(cors());
api.use(express.json({ limit: '2mb' }));

api.get('/health', (_req, res) => {
  res.json({ ok: true });
});

api.get('/nearby-food', async (req, res, next) => {
  const params = parseNearbyFoodQuery(req.query);
  if (params.error) return res.status(400).json({ error: params.error });

  try {
    const items = await fetchNearbyFoodFromProvider(params);
    return res.json({
      provider: poiProvider,
      items: items.map((item) => normalizePoi(item, params.category, poiProvider)),
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    return next(error);
  }
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

api.get('/push/vapid-public-key', (_req, res) => {
  if (!vapidConfigured) return res.status(503).json({ error: 'Push is not configured' });
  return res.json({ publicKey: vapidPublicKey });
});

api.post('/push/subscribe', async (req, res) => {
  const { clientId, coupleId, subscription } = req.body || {};
  if (!clientId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'clientId and complete subscription are required' });
  }
  await PushSubscription.findOneAndUpdate(
    { clientId, endpoint: subscription.endpoint },
    {
      $set: {
        clientId,
        coupleId: coupleId || null,
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return res.json({ ok: true });
});

api.post('/push/poke', async (req, res) => {
  if (!vapidConfigured) return res.status(503).json({ error: 'Push is not configured' });
  const { coupleId, fromClientId } = req.body || {};
  if (!coupleId || !fromClientId) return res.status(400).json({ error: 'coupleId and fromClientId are required' });

  const last = pokeRateLimit.get(coupleId) || 0;
  const now = Date.now();
  if (now - last < POKE_INTERVAL_MS) {
    return res.status(429).json({ error: 'Too frequent', retryAfter: Math.ceil((POKE_INTERVAL_MS - (now - last)) / 1000) });
  }
  pokeRateLimit.set(coupleId, now);

  const couple = await Couple.findOne({ coupleId });
  if (!couple) return res.status(404).json({ error: 'Couple not found' });
  const partnerId = couple.member1 === fromClientId ? couple.member2 : couple.member1;
  if (!partnerId) return res.status(404).json({ error: 'Partner not joined' });

  const subs = await PushSubscription.find({ clientId: partnerId });
  if (!subs.length) return res.json({ ok: true, sent: 0 });

  const payload = JSON.stringify({ title: 'Ta在催你了', body: '快来选今天吃啥', url: '/' });
  const expired = [];
  let sent = 0;
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
      );
      sent += 1;
    } catch (error) {
      if (error?.statusCode === 410 || error?.statusCode === 404) {
        expired.push(sub._id);
      }
    }
  }));
  if (expired.length) await PushSubscription.deleteMany({ _id: { $in: expired } });
  return res.json({ ok: true, sent });
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