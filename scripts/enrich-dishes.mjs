import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const docsDir = path.join(root, 'docs');
const outputFile = path.join(root, 'src', 'data', 'crawledDishes.json');
const sourceFile = path.join(root, 'scripts', 'food-sources.json');
const useRemote = process.argv.includes('--remote');

const categoryRules = [
  ['麻辣烫', /麻辣烫|麻辣拌|冒菜|香锅/],
  ['米饭类', /饭|盖浇|便当|拌饭|煲仔/],
  ['面食', /面|粉|米线|河粉|馄饨|水饺|抄手|乌冬|拉面/],
  ['炸鸡', /炸鸡|鸡翅|鸡排|鸡柳|薯条|汉堡|肯德基|麦当劳/],
  ['烧烤', /烧烤|烤|串|生蚝|羊肉串|牛肉串/],
  ['火锅', /火锅|锅|串串/],
  ['夜宵', /夜宵|粥|炒粉|炒饭|卤味|鸭脖|鸡爪|花甲/],
  ['粤菜', /肠粉|叉烧|烧鸭|虾饺|烧麦|云吞|艇仔|白切/],
  ['湘菜', /湘|剁椒|小炒|擂辣椒|腊味|口味虾/],
  ['川菜', /川|麻婆|水煮|毛血旺|回锅|辣子|口水|担担|酸汤/],
  ['奶茶甜品', /奶茶|咖啡|甜品|蛋糕|布蕾|仙草|冰粉|酸奶|拿铁|柠檬茶/],
  ['减脂餐', /减脂|轻食|沙拉|藜麦|鸡胸|低脂|燕麦/],
  ['便利店速食', /便利店|速食|自热|饭团|三明治|泡面|烤肠|热狗/],
];

const kindRules = [
  ['奶茶', /奶茶|咖啡|甜品|蛋糕|布蕾|仙草|冰粉|酸奶|拿铁|柠檬茶|水果捞/],
  ['炸物', /炸|薯条|鸡排|鸡柳|盐酥|汉堡/],
  ['夜宵', /烧烤|夜宵|小龙虾|花甲|卤味|鸭脖|鸡爪|粥|泡面/],
  ['小吃', /饼|包|饺|丸|串|豆腐|蛋|锅盔|凉皮|小吃|鸡蛋仔|烤肠/],
];

function classifyCategory(name) {
  return categoryRules.find(([, rule]) => rule.test(name))?.[0] || '小吃';
}

function classifyKind(name) {
  return kindRules.find(([, rule]) => rule.test(name))?.[0] || '正餐';
}

function collectStrings(value, result = []) {
  if (typeof value === 'string') {
    result.push(value);
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, result));
    return result;
  }
  if (value && typeof value === 'object') {
    ['name', 'title', 'dish', 'dishName', 'recipeName', 'foodName'].forEach((key) => {
      if (typeof value[key] === 'string') result.push(value[key]);
    });
    Object.values(value).forEach((item) => collectStrings(item, result));
  }
  return result;
}

function cleanName(name) {
  return name
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9·（）() -]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeDish(name) {
  const chineseLength = (name.match(/[\u4e00-\u9fa5]/g) || []).length;
  return chineseLength >= 2 && name.length <= 18 && !/[说明简介地址电话价格分类]/.test(name);
}

async function readLocalDocs() {
  const entries = await fs.readdir(docsDir, { withFileTypes: true }).catch(() => []);
  const names = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const file = path.join(docsDir, entry.name);
    const json = JSON.parse(await fs.readFile(file, 'utf8'));
    names.push(...collectStrings(json));
  }
  return names;
}

async function readRemoteSources() {
  if (!useRemote) return [];
  const sources = JSON.parse(await fs.readFile(sourceFile, 'utf8'));
  const names = [];
  for (const source of sources) {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`${source.name} failed: ${response.status}`);
    const text = await response.text();
    if (source.type === 'json') {
      names.push(...collectStrings(JSON.parse(text)));
    } else {
      names.push(...text.match(/[\u4e00-\u9fa5A-Za-z0-9·（）() -]{2,18}/g));
    }
  }
  return names;
}

const rawNames = [...(await readLocalDocs()), ...(await readRemoteSources())];
const uniqueNames = [...new Set(rawNames.map(cleanName).filter(looksLikeDish))];
const dishes = uniqueNames.map((name) => ({
  name,
  category: classifyCategory(name),
  kind: classifyKind(name),
}));

await fs.writeFile(outputFile, `${JSON.stringify(dishes, null, 2)}\n`, 'utf8');
console.log(`Wrote ${dishes.length} dishes to ${path.relative(root, outputFile)}`);
