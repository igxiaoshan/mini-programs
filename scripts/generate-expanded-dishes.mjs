import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const baseFiles = [
  'src/data/dishes.json',
  'src/data/extraDishes.json',
  'src/data/crawledDishes.json',
];
const outputFile = path.join(root, 'src', 'data', 'generatedDishes.json');

const prefixMap = {
  麻辣烫: ['经典', '招牌', '热辣', '番茄', '藤椒', '骨汤', '双拼', '夜市'],
  米饭类: ['招牌', '经典', '暖胃', '番茄', '酱香', '双人', '省钱', '加蛋'],
  面食: ['招牌', '经典', '热汤', '夜市', '番茄', '辣味', '双拼', '加肉'],
  炸鸡: ['招牌', '经典', '酥脆', '蜂蜜芥末', '甜辣', '双人', '夜市', '加倍'],
  烧烤: ['夜市', '招牌', '经典', '双人', '热辣', '孜然', '蒜香', '酱香'],
  火锅: ['双人', '招牌', '经典', '浓汤', '热辣', '番茄', '菌汤', '鸳鸯'],
  夜宵: ['夜市', '深夜', '热乎', '省钱', '加蛋', '酱香', '双拼', '暖胃'],
  粤菜: ['经典', '招牌', '清爽', '暖胃', '双人', '广式', '鲜香', '热汤'],
  湘菜: ['招牌', '经典', '热辣', '香辣', '下饭', '夜市', '双人', '爆香'],
  川菜: ['招牌', '经典', '热辣', '麻辣', '藤椒', '香锅', '重口', '下饭'],
  小吃: ['街边', '夜市', '招牌', '经典', '省钱', '加蛋', '双拼', '香酥'],
  奶茶甜品: ['招牌', '经典', '加料', '芋泥', '草莓', '冰爽', '双杯', '轻甜'],
  减脂餐: ['轻食', '低脂', '清爽', '高蛋白', '轻盈', '暖胃', '元气', '简单'],
  便利店速食: ['便利店', '速食', '夜宵', '加热', '省钱', '双拼', '加蛋', '简单'],
};

const suffixes = ['套餐', '大份', '小份', '加蛋', '加肉', '双拼', '升级版', '豪华版'];
const promoWords = ['元气', '暖胃', '下饭', '解馋', '快乐', '治愈', '省心', '满足'];
const categoryAlias = {
  奶茶甜品: '奶茶甜品',
};

const tagByText = [
  ['辣', /辣|麻|香锅|火锅|川|湘|藤椒|热辣|麻辣|口味|酸辣/],
  ['清淡', /清蒸|白切|沙拉|轻食|低脂|蔬菜|豆腐|粥|汤/],
  ['热汤', /汤|粥|火锅|麻辣烫|米线|拉面|馄饨|云吞|粉丝|煲/],
  ['快餐', /饭|面|粉|汉堡|便当|盖饭|饭团|三明治|速食|自热|沙县/],
  ['甜', /奶茶|甜|蛋糕|布蕾|仙草|冰粉|酸奶|拿铁|柠檬茶|水果|芋|红豆|芒果|草莓|椰|糖/],
  ['低脂', /减脂|低脂|轻食|沙拉|藜麦|鸡胸|燕麦|蔬菜|清蒸|酸奶|豆腐|玉米/],
  ['夜宵', /夜宵|烧烤|烤|小龙虾|花甲|卤味|鸭脖|鸡爪|泡面|炒粉|炒饭|炸|串|粥/],
  ['两人份', /火锅|烤肉|烤鱼|香锅|小龙虾|烧烤|部队|锅|拼盘|干锅|牛蛙|双人/],
  ['省钱', /沙县|煎饼|手抓饼|鸡蛋|泡面|饭团|关东煮|烤肠|包|饺|馄饨|炒饭|炒粉|蜜雪/],
  ['吃肉', /肉|牛|鸡|鸭|猪|排骨|肥肠|鱼|虾|蟹|蛙|羊|火腿|培根|鸡翅|鸡排|叉烧|烧鸭/],
];

function readJson(relPath) {
  return fs.readFile(path.join(root, relPath), 'utf8').then((text) => JSON.parse(text));
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function cleanName(text) {
  return text.replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5A-Za-z0-9·（）()\-+]/g, '').trim();
}

function inferKind(name, category, fallback = '正餐') {
  if (/奶茶|咖啡|甜品|蛋糕|布蕾|仙草|冰粉|酸奶|拿铁|柠檬茶|水果捞/.test(name)) return '奶茶';
  if (/炸|薯条|鸡排|鸡柳|盐酥|汉堡/.test(name)) return '炸物';
  if (/夜宵|烧烤|小龙虾|花甲|卤味|鸭脖|鸡爪|粥|泡面/.test(name)) return '夜宵';
  if (/沙拉|轻食|鸡胸|藜麦|低脂/.test(name) || category === '减脂餐') return '正餐';
  if (/饭|面|粉|盖饭|便当|米线|拉面|河粉/.test(name)) return '正餐';
  return fallback;
}

function inferTags(name, category, kind) {
  const text = `${name}${category}${kind}`;
  const tags = new Set();
  tagByText.forEach(([tag, rule]) => {
    if (rule.test(text)) tags.add(tag);
  });
  if (kind === '夜宵') tags.add('夜宵');
  if (kind === '奶茶') tags.add('甜');
  if (category === '减脂餐') tags.add('低脂');
  if (category === '火锅') tags.add('两人份');
  if (tags.size === 0) tags.add('快餐');
  return [...tags];
}

function buildVariants(base) {
  const variants = [];
  const prefixes = prefixMap[base.category] || ['经典', '招牌', '元气', '暖胃'];
  const alias = categoryAlias[base.category] || base.category;

  variants.push({
    name: base.name,
    category: alias,
    kind: inferKind(base.name, alias, base.kind),
  });

  prefixes.forEach((prefix, index) => {
    variants.push({
      name: `${prefix}${base.name}`,
      category: alias,
      kind: inferKind(base.name, alias, base.kind),
    });
    if (index < suffixes.length) {
      variants.push({
        name: `${base.name}${suffixes[index]}`,
        category: alias,
        kind: inferKind(base.name, alias, base.kind),
      });
    }
  });

  promoWords.forEach((word) => {
    variants.push({
      name: `${word}${base.name}`,
      category: alias,
      kind: inferKind(base.name, alias, base.kind),
    });
  });

  if (base.tags?.includes('辣')) {
    variants.push({ name: `微辣${base.name}`, category: alias, kind: inferKind(base.name, alias, base.kind) });
    variants.push({ name: `爆辣${base.name}`, category: alias, kind: inferKind(base.name, alias, base.kind) });
  }
  if (base.tags?.includes('甜')) {
    variants.push({ name: `轻甜${base.name}`, category: alias, kind: '奶茶' });
    variants.push({ name: `双杯${base.name}`, category: alias, kind: '奶茶' });
  }
  if (base.tags?.includes('两人份')) {
    variants.push({ name: `双人${base.name}`, category: alias, kind: inferKind(base.name, alias, base.kind) });
  }

  return variants;
}

const source = [];
for (const relPath of baseFiles) {
  const data = await readJson(relPath);
  source.push(...data);
}

const normalized = source
  .filter((item) => item && item.name)
  .map((item) => ({
    name: cleanName(item.name),
    category: item.category || '小吃',
    kind: item.kind || inferKind(item.name, item.category || '小吃'),
    tags: item.tags || inferTags(item.name, item.category || '小吃', item.kind || inferKind(item.name, item.category || '小吃')),
  }));

const seen = new Set();
const generated = [];

for (const base of normalized) {
  for (const variant of buildVariants(base)) {
    const name = cleanName(variant.name);
    const category = variant.category || base.category;
    const kind = variant.kind || inferKind(name, category, base.kind);
    const key = `${name}|${category}|${kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    generated.push({
      id: `gen-${hashText(key).toString(36)}`,
      name,
      category,
      kind,
      tags: inferTags(name, category, kind),
    });
  }
}

const target = 2500;
let cursor = 0;
while (generated.length < target && cursor < generated.length) {
  const base = generated[cursor];
  const aliasPrefix = ['招牌', '经典', '夜市', '暖胃', '元气', '豪华版'][cursor % 6];
  const extra = {
    id: `gen-${hashText(`${base.name}-${aliasPrefix}-${cursor}`).toString(36)}`,
    name: `${aliasPrefix}${base.name}`,
    category: base.category,
    kind: base.kind,
    tags: inferTags(`${aliasPrefix}${base.name}`, base.category, base.kind),
  };
  const key = `${extra.name}|${extra.category}|${extra.kind}`;
  if (!seen.has(key)) {
    seen.add(key);
    generated.push(extra);
  }
  cursor += 1;
}

await fs.writeFile(outputFile, `${JSON.stringify(generated.slice(0, target), null, 2)}\n`, 'utf8');
console.log(`Generated ${Math.min(generated.length, target)} dishes to ${path.relative(root, outputFile)}`);
