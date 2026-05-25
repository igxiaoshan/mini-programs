import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  CheckCheck,
  ChevronRight,
  Clock3,
  Heart,
  Home,
  LayoutGrid,
  RotateCcw,
  Sparkles,
  Star,
  WandSparkles,
  Wind,
} from 'lucide-react';
import baseDishes from './data/dishes.json';
import crawledDishes from './data/crawledDishes.json';
import extraDishes from './data/extraDishes.json';
import generatedDishes from './data/generatedDishes.json';
import { DESIRE_TAGS, buildDailyMenu, calculateRepeatRate, normalizeDish } from './lib/dailyMenu';
import { dayStamp, usePersistentState } from './lib/storage';

const dishes = [
  ...new Map(
    [...baseDishes, ...extraDishes, ...crawledDishes, ...generatedDishes].map((dish) => [
      `${dish.name}-${dish.category || ''}`,
      dish,
    ]),
  ).values(),
].map((dish, index) => normalizeDish(dish, index));

const rollKinds = ['小吃', '正餐', '夜宵', '奶茶', '炸物'];
const couplePrompts = [
  '不许再纠结了',
  '宝宝今天必须好好吃饭',
  '男朋友已经帮你决定好了',
  '再纠结就罚你喝奶茶',
  '今天不准饿肚子',
];

const tabs = [
  { key: 'home', label: '首页', icon: Home },
  { key: 'category', label: '分类', icon: LayoutGrid },
  { key: 'favorites', label: '收藏', icon: Heart },
  { key: 'eaten', label: '已吃', icon: CheckCheck },
  { key: 'wheel', label: '转盘', icon: Sparkles },
];


const wheelColors = [
  '#fff0d8',
  '#ffd2bc',
  '#fff7e9',
  '#ffb99e',
  '#fff2d8',
  '#ffd8bf',
  '#fff8ed',
  '#ffc6ad',
  '#fff0dc',
  '#ffdfc7',
  '#fff6e5',
  '#ffcfb3',
];

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function sample(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function uniqueCategories(list) {
  return ['全部', ...new Set(list.map((item) => item.category))];
}

function polarPoint(angle, radius, center = 100) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

function wheelSlicePath(index, total, radius = 94) {
  const slice = 360 / total;
  const start = index * slice - slice / 2;
  const end = start + slice;
  const startPoint = polarPoint(start, radius);
  const endPoint = polarPoint(end, radius);
  const largeArc = slice > 180 ? 1 : 0;

  return [
    'M 100 100',
    `L ${startPoint.x.toFixed(3)} ${startPoint.y.toFixed(3)}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x.toFixed(3)} ${endPoint.y.toFixed(3)}`,
    'Z',
  ].join(' ');
}

function formatTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function DishCard({ dish, active, favorite, wished, blacklisted, onFavorite, onWish, onEat, onBlacklist }) {
  return (
    <article
      className={`rounded-[24px] border border-amber-100 bg-white/90 p-4 shadow-soft backdrop-blur ${active ? 'ring-2 ring-peach/40' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] font-semibold text-soy">{dish.name}</h3>
            <span className="rounded-full bg-cream-100 px-2.5 py-1 text-[11px] font-medium text-soy">
              {dish.category}
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-tomato">
              {dish.kind}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-6 text-stone-600">{dish.reason}</p>
        </div>
        <button
          className={`mt-0.5 rounded-full border p-2 transition ${favorite ? 'border-peach bg-peach text-white' : 'border-amber-100 bg-cream-50 text-soy'}`}
          onClick={() => onFavorite(dish.id)}
          aria-label="收藏"
        >
          <Star className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 rounded-[18px] bg-cream-50 px-3 py-2 text-[13px] leading-6 text-soy">
        {dish.coupleLine}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(dish.tags || []).slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-[11px] text-stone-500">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium transition ${wished ? 'bg-mint text-white' : 'bg-cream-100 text-soy'}`}
          onClick={() => onWish(dish.id)}
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          下次一定吃
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-full bg-tomato px-3 py-2 text-[12px] font-medium text-white transition hover:brightness-95"
          onClick={() => onEat(dish)}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          今日已吃
        </button>
        <button
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium transition ${blacklisted ? 'bg-soy text-white' : 'bg-white text-stone-500'}`}
          onClick={() => onBlacklist(dish.id)}
        >
          {blacklisted ? '已屏蔽' : '最近不想吃'}
        </button>
      </div>
    </article>
  );
}

function App() {
  const [tab, setTab] = useState('home');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [search, setSearch] = useState('');
  const [desiredTag, setDesiredTag] = usePersistentState('couple-food-desired-tag', 'all');
  const [quote, setQuote] = useState('宝宝，今天我来替你做决定。');
  const [rolling, setRolling] = useState(false);
  const [rollTrack, setRollTrack] = useState([]);
  const [rollIndex, setRollIndex] = useState(0);
  const [result, setResult] = usePersistentState('couple-food-result', null);
  const [favorites, setFavorites] = usePersistentState('couple-food-favorites', []);
  const [wishList, setWishList] = usePersistentState('couple-food-wishlist', []);
  const [blacklist, setBlacklist] = usePersistentState('couple-food-blacklist', []);
  const [eatenLog, setEatenLog] = usePersistentState('couple-food-eaten', []);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelWinner, setWheelWinner] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const wheelTimer = useRef(null);
  const rollTimer = useRef(null);

  const dailyMenuOptions = useMemo(
    () => ({
      excludeIds: blacklist,
      requiredTags: desiredTag === 'all' ? [] : [desiredTag],
    }),
    [blacklist, desiredTag],
  );
  const dailyDishes = useMemo(() => buildDailyMenu(dishes, new Date(), 14, dailyMenuOptions), [
    dailyMenuOptions,
  ]);
  const wheelOptions = useMemo(() => {
    const picked = new Set();
    const opts = [];
    const add = (name) => { if (!picked.has(name) && opts.length < 12) { picked.add(name); opts.push(name); } };
    dailyDishes.forEach(d => add(d.name));
    dishes.forEach(d => add(d.name));
    return opts;
  }, [dailyDishes]);
  const previousDailyDishes = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return buildDailyMenu(dishes, yesterday, 14, dailyMenuOptions);
  }, [dailyMenuOptions]);
  const dailyRepeatRate = useMemo(
    () => calculateRepeatRate(dailyDishes, previousDailyDishes),
    [dailyDishes, previousDailyDishes],
  );
  const categories = useMemo(() => uniqueCategories(dailyDishes), [dailyDishes]);

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) setInstallPrompt(null);
  }, []);

  useEffect(
    () => () => {
      if (rollTimer.current) clearInterval(rollTimer.current);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
    },
    [],
  );

  const filteredDishes = useMemo(() => {
    return dailyDishes.filter((dish) => {
      const searchMatch =
        !search ||
        dish.name.includes(search) ||
        dish.category.includes(search) ||
        dish.kind.includes(search) ||
        dish.tags?.some((tag) => tag.includes(search));
      return searchMatch;
    });
  }, [dailyDishes, search]);
  const groupedDishes = useMemo(() => {
    return categories
      .filter((category) => category !== '全部')
      .map((category) => ({
        category,
        dishes: filteredDishes.filter((dish) => dish.category === category),
      }))
      .filter((group) => group.dishes.length);
  }, [categories, filteredDishes]);

  const favoriteDishes = useMemo(
    () => dishes.filter((dish) => favorites.includes(dish.id)),
    [favorites],
  );
  const wishDishes = useMemo(() => dishes.filter((dish) => wishList.includes(dish.id)), [wishList]);
  const blacklistDishes = useMemo(
    () => dishes.filter((dish) => blacklist.includes(dish.id)),
    [blacklist],
  );
  const today = dayStamp();
  const todayEaten = useMemo(
    () => eatenLog.filter((entry) => entry.date === today),
    [eatenLog, today],
  );
  const toggleFavorite = (id) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleWish = (id) => {
    setWishList((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleBlacklist = (id) => {
    setBlacklist((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const addTodayEaten = (dish) => {
    setEatenLog((prev) => [
      { id: dish.id, date: today, time: formatTime(), name: dish.name },
      ...prev,
    ]);
  };

  const setMood = (text) => setQuote(text);

  const scrollToCategory = (category) => {
    setActiveCategory(category);
    if (category === '全部') {
      document.getElementById('category-menu-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    document
      .getElementById(`category-section-${category}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const startRandomPick = () => {
    if (rolling) return;
    if (rollTimer.current) clearInterval(rollTimer.current);

    const kind = sample(rollKinds);
    const kindPool = dailyDishes.filter((dish) => dish.kind === kind);
    const pool = kindPool.length ? kindPool : dailyDishes;
    const track = shuffle(pool)
      .slice(0, 10)
      .map((item) => item.name);

    setRolling(true);
    setRollTrack(track);
    setRollIndex(0);
    setQuote(sample(couplePrompts));

    let steps = 0;
    rollTimer.current = setInterval(() => {
      steps += 1;
      setRollIndex((current) => current + 1);
      if (steps >= 8) {
        clearInterval(rollTimer.current);
        const picked = sample(pool);
        setRollIndex(0);
        setResult({ ...picked, pickedAt: Date.now(), kindHint: kind });
        setRolling(false);
        setQuote(picked.coupleLine);
      }
    }, 110);
  };

  const startWheel = () => {
    if (wheelSpinning) return;
    const slice = 360 / wheelOptions.length;
    const winnerIndex = Math.floor(Math.random() * wheelOptions.length);
    setWheelWinner('');
    setWheelSpinning(true);
    setWheelRotation((current) => {
      const currentAngle = ((current % 360) + 360) % 360;
      const landingAngle = (360 - winnerIndex * slice) % 360;
      const delta = ((landingAngle - currentAngle + 360) % 360) + 360 * 5;
      return current + delta;
    });
    wheelTimer.current = setTimeout(() => {
      setWheelWinner(wheelOptions[winnerIndex]);
      setWheelSpinning(false);
    }, 2850);
  };

  const randomPreview = result || sample(dailyDishes.length ? dailyDishes : dishes);
  const displayQuotes = [
    `今天适合吃 ${randomPreview.name}，因为 ${randomPreview.reason}`,
    quote,
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fffaf0,_#fff4dc_36%,_#fff1d0_100%)] text-stone-800">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col pb-24">
        <header className="sticky top-0 z-30 border-b border-amber-100/80 bg-cream-50/90 px-4 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] text-stone-500">情侣互动点餐小工具</p>
              <h1 className="text-[22px] font-semibold tracking-tight text-soy">今天吃啥</h1>
            </div>
            <div className="flex items-center gap-2">
              {installPrompt ? (
                <button
                  className="rounded-full bg-soy px-3 py-2 text-[12px] font-medium text-white"
                  onClick={() => installPrompt.prompt?.()}
                >
                  添加到桌面
                </button>
              ) : null}
              <button className="rounded-full bg-white px-3 py-2 text-[12px] font-medium text-soy shadow-sm">
                {dayStamp()}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-4">
          {tab === 'home' && (
            <div className="space-y-4">
              <section className="overflow-hidden rounded-[28px] bg-white p-4 shadow-soft">
                <div className="rounded-[24px] bg-[linear-gradient(180deg,#fff8ea,#fff0d8)] px-4 py-5 text-center">
                  <p className="mx-auto inline-flex rounded-full bg-white/80 px-3 py-1 text-[12px] font-medium text-stone-500 shadow-sm">
                    今天吃什么
                  </p>
                  <h2 className="mt-3 text-[21px] font-semibold tracking-normal text-soy">
                    把决定权交给我
                  </h2>
                  <p className="mx-auto mt-2 max-w-[240px] text-[13px] leading-6 text-stone-600">
                    随机抽一口，今天就不用继续纠结了。
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-[18px] bg-cream-50 px-2 py-3 text-center">
                    <p className="text-[11px] text-stone-500">今日上新</p>
                    <p className="mt-1 text-[18px] font-semibold leading-none text-tomato">
                      {dailyDishes.length}
                    </p>
                  </div>
                  <div className="rounded-[18px] bg-cream-50 px-2 py-3 text-center">
                    <p className="text-[11px] text-stone-500">今日已吃</p>
                    <p className="mt-1 text-[18px] font-semibold leading-none text-soy">
                      {todayEaten.length}
                    </p>
                  </div>
                  <div className="rounded-[18px] bg-cream-50 px-2 py-3 text-center">
                    <p className="text-[11px] text-stone-500">重复率</p>
                    <p className="mt-1 text-[18px] font-semibold leading-none text-mint">
                      {Math.round(dailyRepeatRate * 100)}%
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-soy">今天想要</p>
                    <span className="text-[11px] text-stone-500">会影响今日上新和随机</span>
                  </div>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {DESIRE_TAGS.map((tag) => {
                      const active = desiredTag === tag.key;
                      return (
                        <button
                          key={tag.key}
                          className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-medium transition ${active ? 'bg-soy text-white shadow-sm' : 'bg-cream-50 text-soy'}`}
                          onClick={() => {
                            setDesiredTag(tag.key);
                            setActiveCategory('全部');
                          }}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[22px] bg-tomato px-4 py-3 text-[15px] font-semibold text-white shadow-soft transition active:scale-[0.99]"
                  onClick={startRandomPick}
                >
                  <WandSparkles className="h-4 w-4" />
                  今天吃啥
                </button>

                <div className="mt-4 rounded-[24px] border border-amber-100 bg-cream-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-medium text-stone-500">随机滚动</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-soy">
                      {rolling ? '正在帮你选' : result ? '已经停下' : '未开始'}
                    </span>
                  </div>
                  <div className="relative mt-3 h-40 overflow-hidden rounded-[20px] bg-white">
                    <div className="pointer-events-none absolute inset-x-4 top-1/2 z-10 h-10 -translate-y-1/2 rounded-full border border-peach/25 bg-peach/8" />
                    <div
                      className="transition-transform duration-150 ease-out"
                      style={{ transform: `translateY(${60 - rollIndex * 40}px)` }}
                    >
                      {(rolling ? rollTrack : (result ? [result.name] : ['今天吃啥'])) .map((name, index) => (
                        <div
                          key={`${name}-${index}`}
                          className="flex h-10 items-center justify-center text-[18px] font-semibold text-soy"
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {result ? (
                <section className="rounded-[28px] bg-white p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] text-stone-500">最终推荐</p>
                      <h3 className="text-[19px] font-semibold text-soy">{result.name}</h3>
                    </div>
                    <span className="rounded-full bg-cream-100 px-3 py-1 text-[11px] text-soy">
                      {result.kindHint || result.kind}
                    </span>
                  </div>
                  <div className={`mt-4 rounded-[26px] bg-[linear-gradient(180deg,#fff9ee,#fff1d7)] p-4 ${rolling ? 'animate-flipCard' : 'animate-slideUp'}`}>
                    <p className="text-[12px] text-stone-500">推荐理由</p>
                    <p className="mt-1 text-[15px] leading-7 text-soy">{result.reason}</p>
                    <p className="mt-3 rounded-[20px] bg-white/80 px-3 py-3 text-[14px] leading-7 text-tomato">
                      {result.coupleLine}
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="rounded-full bg-cream-100 px-3 py-2 text-[12px] font-medium text-soy"
                      onClick={() => toggleFavorite(result.id)}
                    >
                      {favorites.includes(result.id) ? '已收藏' : '收藏它'}
                    </button>
                    <button
                      className="rounded-full bg-mint px-3 py-2 text-[12px] font-medium text-white"
                      onClick={() => toggleWish(result.id)}
                    >
                      {wishList.includes(result.id) ? '已标记' : '下次吃'}
                    </button>
                    <button
                      className="rounded-full bg-tomato px-3 py-2 text-[12px] font-medium text-white"
                      onClick={() => addTodayEaten(result)}
                    >
                      记到已吃
                    </button>
                    <button
                      className="rounded-full bg-white px-3 py-2 text-[12px] font-medium text-stone-500"
                      onClick={() => toggleBlacklist(result.id)}
                    >
                      {blacklist.includes(result.id) ? '取消屏蔽' : '最近不想吃'}
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="rounded-[28px] bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-semibold text-soy">情侣互动文案</h3>
                  <button className="inline-flex items-center gap-1 text-[12px] text-stone-500" onClick={() => setMood(sample(couplePrompts))}>
                    换一句 <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-3 rounded-[22px] bg-cream-50 p-4 text-[15px] leading-7 text-soy">
                  {displayQuotes[0]}
                </div>
                <p className="mt-3 rounded-[22px] bg-white px-4 py-3 text-[14px] leading-7 text-tomato shadow-sm">
                  {displayQuotes[1]}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {couplePrompts.map((item) => (
                    <button
                      key={item}
                      className="rounded-full bg-cream-100 px-3 py-2 text-[12px] text-soy"
                      onClick={() => setMood(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-semibold text-soy">快速分类</h3>
                  <span className="text-[12px] text-stone-500">点一下就能筛</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.slice(1, 9).map((category) => (
                    <button
                      key={category}
                      className={`rounded-full px-3 py-2 text-[12px] transition ${activeCategory === category ? 'bg-tomato text-white' : 'bg-cream-100 text-soy'}`}
                      onClick={() => {
                        setActiveCategory(category);
                        setTab('category');
                      }}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === 'category' && (
            <div id="category-menu-top" className="space-y-3">
              <section className="sticky top-[73px] z-20 rounded-[24px] bg-white/95 p-3 shadow-soft backdrop-blur">
                <div className="flex items-center gap-2 rounded-full bg-cream-50 px-4 py-3">
                  <Wind className="h-4 w-4 text-peach" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜菜名、分类、口味"
                    className="w-full bg-transparent text-[14px] outline-none placeholder:text-stone-400"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between px-1 text-[12px] text-stone-500">
                  <span>今日上新 {filteredDishes.length} 道</span>
                  <span>{activeCategory}</span>
                </div>
              </section>

              <section className="grid grid-cols-[86px_minmax(0,1fr)] gap-3">
                <aside className="sticky top-[165px] h-[calc(100vh-250px)] overflow-y-auto rounded-[22px] bg-white p-2 shadow-soft">
                  {categories.map((category) => {
                    const count =
                      category === '全部'
                        ? filteredDishes.length
                        : filteredDishes.filter((dish) => dish.category === category).length;
                    return (
                    <button
                      key={category}
                      className={`mb-1 flex min-h-11 w-full flex-col items-center justify-center rounded-[16px] px-2 py-2 text-center transition ${activeCategory === category ? 'bg-soy text-white shadow-sm' : 'bg-cream-50 text-soy'}`}
                      onClick={() => scrollToCategory(category)}
                    >
                      <span className="text-[12px] font-medium leading-4">{category}</span>
                      <span className={`mt-0.5 text-[10px] ${activeCategory === category ? 'text-white/75' : 'text-stone-400'}`}>
                        {count}
                      </span>
                    </button>
                    );
                  })}
                </aside>

                <div className="min-w-0 space-y-4">
                  {groupedDishes.length ? (
                    groupedDishes.map((group) => (
                      <section
                        key={group.category}
                        id={`category-section-${group.category}`}
                        className="scroll-mt-44 space-y-2"
                      >
                        <div className="sticky top-[165px] z-10 rounded-full bg-cream-50/95 px-3 py-2 text-[13px] font-semibold text-soy backdrop-blur">
                          {group.category}
                          <span className="ml-2 text-[11px] font-normal text-stone-500">
                            {group.dishes.length} 道
                          </span>
                        </div>
                        <div className="space-y-2">
                          {group.dishes.map((dish) => (
                            <DishCard
                              key={dish.id}
                              dish={dish}
                              active={result?.id === dish.id}
                              favorite={favorites.includes(dish.id)}
                              wished={wishList.includes(dish.id)}
                              blacklisted={blacklist.includes(dish.id)}
                              onFavorite={toggleFavorite}
                              onWish={toggleWish}
                              onEat={addTodayEaten}
                              onBlacklist={toggleBlacklist}
                            />
                          ))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <div className="rounded-[22px] bg-white px-4 py-8 text-center text-[13px] text-stone-500 shadow-soft">
                      没搜到想吃的，换个关键词试试。
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {tab === 'favorites' && (
            <div className="space-y-4">
              <section className="rounded-[28px] bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-semibold text-soy">收藏夹</h3>
                  <span className="text-[12px] text-stone-500">{favoriteDishes.length} 个</span>
                </div>
                <div className="mt-3 space-y-3">
                  {favoriteDishes.length ? (
                    favoriteDishes.map((dish) => (
                      <DishCard
                        key={dish.id}
                        dish={dish}
                        active={result?.id === dish.id}
                        favorite
                        wished={wishList.includes(dish.id)}
                        blacklisted={blacklist.includes(dish.id)}
                        onFavorite={toggleFavorite}
                        onWish={toggleWish}
                        onEat={addTodayEaten}
                        onBlacklist={toggleBlacklist}
                      />
                    ))
                  ) : (
                    <div className="rounded-[22px] bg-cream-50 px-4 py-6 text-center text-[13px] text-stone-500">
                      还没有收藏，看到喜欢的就点一下星星吧。
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[28px] bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-semibold text-soy">下次一定吃</h3>
                  <span className="text-[12px] text-stone-500">{wishDishes.length} 个</span>
                </div>
                <div className="mt-3 space-y-2">
                  {wishDishes.length ? (
                    wishDishes.map((dish) => (
                      <div
                        key={dish.id}
                        className="flex items-center justify-between rounded-[20px] bg-cream-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-[14px] font-medium text-soy">{dish.name}</p>
                          <p className="text-[12px] text-stone-500">{dish.category}</p>
                        </div>
                        <button className="text-[12px] text-tomato" onClick={() => toggleWish(dish.id)}>
                          取消
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] bg-cream-50 px-4 py-6 text-center text-[13px] text-stone-500">
                      还没有标记“下次一定吃”。
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[28px] bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[17px] font-semibold text-soy">近期不想吃</h3>
                    <p className="mt-1 text-[12px] text-stone-500">这些不会参与每日上新和随机推荐</p>
                  </div>
                  <span className="text-[12px] text-stone-500">{blacklistDishes.length} 个</span>
                </div>
                <div className="mt-3 space-y-2">
                  {blacklistDishes.length ? (
                    blacklistDishes.map((dish) => (
                      <div
                        key={dish.id}
                        className="flex items-center justify-between gap-3 rounded-[20px] bg-cream-50 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-soy">{dish.name}</p>
                          <p className="mt-1 text-[12px] text-stone-500">
                            {dish.category} · {(dish.tags || []).slice(0, 2).join(' / ')}
                          </p>
                        </div>
                        <button
                          className="shrink-0 rounded-full bg-white px-3 py-2 text-[12px] text-tomato"
                          onClick={() => toggleBlacklist(dish.id)}
                        >
                          移出
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] bg-cream-50 px-4 py-6 text-center text-[13px] text-stone-500">
                      没有屏蔽任何菜，今日菜单会更丰富。
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {tab === 'eaten' && (
            <div className="space-y-4">
              <section className="rounded-[28px] bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-semibold text-soy">今日已吃</h3>
                  <button
                    className="text-[12px] text-stone-500"
                    onClick={() => setEatenLog((prev) => prev.filter((entry) => entry.date !== today))}
                  >
                    清空今天
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {todayEaten.length ? (
                    todayEaten.map((entry, index) => (
                      <div
                        key={`${entry.id}-${entry.time}-${index}`}
                        className="flex items-center justify-between rounded-[20px] bg-cream-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-[14px] font-medium text-soy">{entry.name}</p>
                          <p className="text-[12px] text-stone-500">{entry.time}</p>
                        </div>
                        <button className="text-[12px] text-tomato" onClick={() => toggleFavorite(entry.id)}>
                          再收藏
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] bg-cream-50 px-4 py-6 text-center text-[13px] text-stone-500">
                      今天还没有记录，吃完记得点一下“今日已吃”。
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[28px] bg-white p-4 shadow-soft">
                <h3 className="text-[17px] font-semibold text-soy">最近记录</h3>
                <div className="mt-3 space-y-2">
                  {eatenLog.slice(0, 6).map((entry, index) => (
                    <div
                      key={`${entry.id}-${entry.date}-${entry.time}-${index}`}
                      className="flex items-center justify-between rounded-[20px] bg-cream-50 px-4 py-3"
                    >
                      <div>
                        <p className="text-[14px] font-medium text-soy">{entry.name}</p>
                        <p className="text-[12px] text-stone-500">
                          {entry.date} {entry.time}
                        </p>
                      </div>
                      <Clock3 className="h-4 w-4 text-peach" />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === 'wheel' && (
            <div className="space-y-4">
              <section className="rounded-[28px] bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] text-stone-500">纠结终结者转盘</p>
                    <h3 className="text-[18px] font-semibold text-soy">转一下就决定</h3>
                  </div>
                  <button
                    className="inline-flex items-center gap-1 rounded-full bg-peach px-3 py-2 text-[12px] font-medium text-white"
                    onClick={startWheel}
                  >
                    开始 <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="relative mx-auto mt-5 aspect-square w-full max-w-[304px] px-2">
                  <div className="absolute left-1/2 top-1 z-30 h-0 w-0 -translate-x-1/2 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-tomato drop-shadow" />
                  <div className="absolute inset-2 rounded-full bg-white p-2 shadow-soft">
                    <svg
                      viewBox="0 0 200 200"
                      role="img"
                      aria-label="纠结终结者转盘"
                      className={`h-full w-full overflow-visible rounded-full ${wheelSpinning ? 'transition-transform duration-[2850ms] ease-[cubic-bezier(.17,.67,.16,1)]' : 'transition-transform duration-700 ease-out'}`}
                      style={{ transform: `rotate(${wheelRotation}deg)` }}
                    >
                      <circle cx="100" cy="100" r="98" fill="#fffaf0" />
                      {wheelOptions.map((item, index) => {
                        const angle = (360 / wheelOptions.length) * index;
                        const textPoint = polarPoint(angle, 67);
                        return (
                          <g key={item}>
                            <path
                              d={wheelSlicePath(index, wheelOptions.length)}
                              fill={wheelColors[index % wheelColors.length]}
                              stroke="#ffffff"
                              strokeWidth="1.6"
                            />
                            <text
                              x={textPoint.x}
                              y={textPoint.y}
                              fill="#7b5140"
                              fontSize={item.length > 4 ? '7.4' : '8.6'}
                              fontWeight="700"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              transform={`rotate(${angle} ${textPoint.x} ${textPoint.y})`}
                            >
                              {item}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                  <button
                    className="absolute left-1/2 top-1/2 z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-cream-100 text-[13px] font-semibold text-soy shadow-soft"
                    onClick={startWheel}
                    aria-label="开始转盘"
                  >
                    开始
                  </button>
                </div>

                <button
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-[22px] bg-soy px-4 py-3 text-[15px] font-semibold text-white"
                  onClick={startWheel}
                >
                  {wheelSpinning ? '正在转动...' : '开始转盘'}
                </button>

                <div className="mt-4 rounded-[22px] bg-cream-50 p-4">
                  <p className="text-[12px] text-stone-500">结果</p>
                  <p className="mt-1 text-[16px] font-semibold text-tomato">
                    {wheelWinner || '还没有开始'}
                  </p>
                </div>
              </section>
            </div>
          )}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-100 bg-cream-50/95 px-3 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
            {tabs.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  className={`flex flex-col items-center justify-center gap-1 rounded-[18px] py-2 text-[11px] ${active ? 'text-tomato' : 'text-stone-500'}`}
                  onClick={() => setTab(key)}
                >
                  <Icon className={`h-5 w-5 ${active ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export default App;
