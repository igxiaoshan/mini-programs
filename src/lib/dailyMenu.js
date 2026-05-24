const reasonByKind = {
  小吃: ['不想吃太正式的时候，它刚好能接住嘴馋。', '份量轻松，适合先垫一口再慢慢开心。'],
  正餐: ['有主食有滋味，适合认真把这顿饭吃好。', '吃起来踏实，能把今天的能量补回来。'],
  夜宵: ['夜里吃点热乎香口的，心情会放松很多。', '很有烟火气，适合结束今天的小纠结。'],
  奶茶: ['甜甜的一口很会哄人，适合奖励自己。', '饭可以认真吃，甜的快乐也可以有。'],
  炸物: ['酥香直接，适合今天想要一点快乐暴击。', '外脆里香，吃起来很有满足感。'],
};

const lineByKind = {
  小吃: ['宝宝今天可以先吃点小吃，不许空着肚子纠结。', '这个很适合你，吃完再慢慢想别的。'],
  正餐: ['今天就认真吃它，男朋友已经帮你决定好了。', '这顿要好好吃，最近辛苦了。'],
  夜宵: ['夜宵可以吃，但不准饿着自己硬撑。', '今天晚上就它了，不许再纠结。'],
  奶茶: ['可以喝点甜的，但也要记得好好吃饭。', '再纠结就罚你喝这杯。'],
  炸物: ['今天允许快乐一下，吃完要多喝水。', '炸物快乐到账，不准皱眉头。'],
};

export const DESIRE_TAGS = [
  { key: 'all', label: '都可以' },
  { key: '热汤', label: '热乎的' },
  { key: '清淡', label: '清淡点' },
  { key: '辣', label: '想吃辣' },
  { key: '吃肉', label: '想吃肉' },
  { key: '甜', label: '想喝甜' },
  { key: '低脂', label: '轻一点' },
  { key: '夜宵', label: '夜宵感' },
  { key: '省钱', label: '省钱' },
  { key: '快餐', label: '快一点' },
  { key: '两人份', label: '两人吃' },
];

const tagRules = [
  ['辣', /辣|麻|川|湘|剁椒|藤椒|酸辣|香锅|冒菜|火锅|串串|毛血旺|水煮|辣子|口味/],
  ['清淡', /清蒸|白切|粥|汤|沙拉|轻食|低脂|蔬菜|云吞|肠粉|鸡蛋羹|豆腐/],
  ['热汤', /汤|粥|火锅|麻辣烫|米线|拉面|馄饨|云吞|粉丝|羊肉泡馍|关东煮|煲/],
  ['快餐', /饭|面|粉|汉堡|便当|盖饭|饭团|三明治|速食|自热|麦当劳|肯德基|沙县/],
  ['甜', /奶茶|甜|蛋糕|布蕾|仙草|冰粉|酸奶|拿铁|柠檬茶|水果|芋|红豆|芒果|草莓|椰|糖/],
  ['低脂', /减脂|低脂|轻食|沙拉|藜麦|鸡胸|燕麦|蔬菜|清蒸|酸奶|豆腐|玉米/],
  ['夜宵', /夜宵|烧烤|烤|小龙虾|花甲|卤味|鸭脖|鸡爪|泡面|炒粉|炒饭|炸|串|粥/],
  ['两人份', /火锅|烤肉|烤鱼|香锅|小龙虾|烧烤|部队|锅|拼盘|干锅|牛蛙|烤鱼/],
  ['省钱', /沙县|煎饼|手抓饼|鸡蛋|泡面|饭团|关东煮|烤肠|包|饺|馄饨|炒饭|炒粉|蜜雪/],
  ['吃肉', /肉|牛|鸡|鸭|猪|排骨|肥肠|鱼|虾|蟹|蛙|羊|火腿|培根|鸡翅|鸡排|叉烧|烧鸭/],
];

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function slugify(text, fallback) {
  const hash = hashText(text).toString(36);
  return `${fallback}-${hash}`;
}

function chooseByHash(name, list) {
  return list[hashText(name) % list.length];
}

function inferTags(dish) {
  const text = `${dish.name || ''}${dish.category || ''}${dish.kind || ''}`;
  const tags = new Set(dish.tags || []);

  tagRules.forEach(([tag, rule]) => {
    if (rule.test(text)) tags.add(tag);
  });
  if (dish.kind === '夜宵') tags.add('夜宵');
  if (dish.kind === '奶茶') tags.add('甜');
  if (dish.kind === '炸物') tags.add('夜宵');
  if (dish.category === '减脂餐') tags.add('低脂');
  if (dish.category === '奶茶甜品') tags.add('甜');
  if (dish.category === '火锅') tags.add('两人份');
  if (tags.size === 0) tags.add('快餐');

  return [...tags];
}

export function normalizeDish(dish, index) {
  const kind = dish.kind || '正餐';
  const reasonPool = reasonByKind[kind] || reasonByKind.正餐;
  const linePool = lineByKind[kind] || lineByKind.正餐;
  return {
    id: dish.id || slugify(`${dish.name}-${dish.category}-${kind}`, `dish-${index}`),
    name: dish.name,
    category: dish.category || '小吃',
    kind,
    tags: inferTags(dish),
    reason: dish.reason || `${chooseByHash(dish.name, reasonPool)}`,
    coupleLine: dish.coupleLine || `今天吃${dish.name}吧，${chooseByHash(dish.name, linePool)}`,
  };
}

function shuffleWithSeed(list, seed) {
  const random = seededRandom(seed);
  return [...list]
    .map((item) => ({ item, sort: random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isBeforeDay(left, right) {
  return dateKey(left) < dateKey(right);
}

function dishMatchesTags(dish, requiredTags = []) {
  if (!requiredTags.length || requiredTags.includes('all')) return true;
  return requiredTags.every((tag) => dish.tags?.includes(tag));
}

function prepareLibrary(library, options = {}) {
  const excludeIds = new Set(options.excludeIds || []);
  const requiredTags = options.requiredTags || [];
  return library.filter((dish) => !excludeIds.has(dish.id) && dishMatchesTags(dish, requiredTags));
}

function buildOneDayMenu(library, date, previousMenu) {
  const key = dateKey(date);
  const seed = hashText(key);
  const random = seededRandom(seed);
  const count = 30 + Math.floor(random() * 21);
  const maxRepeat = Math.floor(count * 0.3);
  const previousIds = new Set(previousMenu.map((dish) => dish.id));
  const repeatCount = previousMenu.length ? Math.floor(random() * (maxRepeat + 1)) : 0;
  const repeats = shuffleWithSeed(previousMenu, seed ^ 0xa5a5).slice(0, repeatCount);
  const freshPool = library.filter((dish) => !previousIds.has(dish.id));
  const balancedFresh = shuffleBalancedByCategory(freshPool, seed ^ 0x5a5a);
  const picked = [...repeats, ...balancedFresh.slice(0, count - repeats.length)];

  if (picked.length < count) {
    const pickedIds = new Set(picked.map((dish) => dish.id));
    const fallback = shuffleWithSeed(library, seed ^ 0x3c3c).filter((dish) => !pickedIds.has(dish.id));
    picked.push(...fallback.slice(0, count - picked.length));
  }

  return shuffleWithSeed(picked, seed ^ 0x9e37);
}

function shuffleBalancedByCategory(list, seed) {
  const groups = new Map();
  list.forEach((dish) => {
    if (!groups.has(dish.category)) groups.set(dish.category, []);
    groups.get(dish.category).push(dish);
  });

  const shuffledGroups = [...groups.entries()].map(([category, dishes]) => [
    category,
    shuffleWithSeed(dishes, seed ^ hashText(category)),
  ]);
  const orderedCategories = shuffleWithSeed(
    shuffledGroups.map(([category]) => category),
    seed,
  );
  const byCategory = new Map(shuffledGroups);
  const result = [];
  let hasItems = true;

  while (hasItems) {
    hasItems = false;
    orderedCategories.forEach((category) => {
      const bucket = byCategory.get(category);
      const item = bucket?.shift();
      if (item) {
        result.push(item);
        hasItems = true;
      }
    });
  }

  return result;
}

export function buildDailyMenu(library, date = new Date(), lookbackDays = 14, options = {}) {
  const days = Number.isFinite(lookbackDays) ? lookbackDays : 14;
  const eligibleLibrary = prepareLibrary(library, options);
  const sourceLibrary =
    eligibleLibrary.length >= 30
      ? eligibleLibrary
      : prepareLibrary(library, {
          excludeIds: options.excludeIds,
        });
  let menu = [];
  const anchor = new Date(2025, 0, 1);
  let current = isBeforeDay(date, anchor) ? addDays(date, -days) : anchor;
  while (!isBeforeDay(date, current)) {
    menu = buildOneDayMenu(sourceLibrary, current, menu);
    current = addDays(current, 1);
  }
  return menu;
}

export function calculateRepeatRate(currentMenu, previousMenu) {
  if (!currentMenu.length) return 0;
  const previousIds = new Set(previousMenu.map((dish) => dish.id));
  const repeats = currentMenu.filter((dish) => previousIds.has(dish.id)).length;
  return repeats / currentMenu.length;
}
