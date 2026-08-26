/**
 * 扩展系统配置：皮肤、经济、签到、任务、成就、宝箱。
 * LocalStorage 结构：
 *   GameConfig.COIN_KEY       -> { coins: 0 }                   金币独立存档
 *   GameConfig.PROFILE_KEY    -> 皮肤/碎片/签到/任务/成就/宝箱
 *   GameConfig.STORAGE_KEY    -> 原有最高分/进度/设置（旧存档自动升级）
 */
const SKIN_CONFIG = Object.freeze([
  {
    id: "standard_green",
    name: "标准绿",
    rarity: "common",
    price: 0,
    default: true,
    desc: "经典制式涂装，无属性加成",
    bonuses: {},
    colors: { body: "#4caf50", accent: "#c8ffd0", muzzle: "#ffd166" },
    visuals: {}
  },
  {
    id: "desert_camo",
    name: "沙漠迷彩",
    rarity: "common",
    price: 900,
    desc: "沙地伪装，机动性小幅提升",
    bonuses: { speed: 0.05 },
    colors: { body: "#c89b5e", accent: "#f3d9a4", muzzle: "#ffcf66" },
    visuals: { trail: true, trailColor: "rgba(235,203,148,0.55)" }
  },
  {
    id: "snow_camo",
    name: "雪地涂装",
    rarity: "common",
    price: 1000,
    desc: "极地伪装，护甲小幅提升",
    bonuses: { armor: 0.05 },
    colors: { body: "#dbe6ef", accent: "#ffffff", muzzle: "#bcd8ff" },
    visuals: {}
  },
  {
    id: "red_alert",
    name: "红色警报",
    rarity: "rare",
    price: 3200,
    desc: "火力 +10%，弹速 +10%",
    bonuses: { firepower: 0.1, bulletSpeed: 0.1 },
    colors: { body: "#d64b4b", accent: "#ffb0a0", muzzle: "#ff7f6b" },
    visuals: { muzzleColor: "#ff6b5b" }
  },
  {
    id: "blue_lightning",
    name: "蓝色闪电",
    rarity: "rare",
    price: 3400,
    desc: "速度 +15%",
    bonuses: { speed: 0.15 },
    colors: { body: "#2f7fe8", accent: "#a8d4ff", muzzle: "#6fc3ff" },
    visuals: { trail: true, trailColor: "rgba(111,195,255,0.6)", muzzleColor: "#6fc3ff" }
  },
  {
    id: "obsidian",
    name: "黑曜石",
    rarity: "rare",
    price: 3600,
    desc: "护甲 +15%",
    bonuses: { armor: 0.15 },
    colors: { body: "#3a4352", accent: "#9aa8ba", muzzle: "#8b6bff" },
    visuals: { aura: true, auraColor: "rgba(139,107,255,0.35)", muzzleColor: "#8b6bff" }
  },
  {
    id: "city_camo",
    name: "城市迷彩",
    rarity: "rare",
    price: 3800,
    desc: "道具持续时间 +20%",
    bonuses: { powerupDuration: 0.2 },
    colors: { body: "#66707d", accent: "#c5ccd4", muzzle: "#7fd8ff" },
    visuals: {}
  },
  {
    id: "golden_warrior",
    name: "黄金战神",
    rarity: "epic",
    price: 8500,
    desc: "火力 +15%，金币获取 +15%",
    bonuses: { firepower: 0.15, coinRate: 0.15 },
    colors: { body: "#e6b23a", accent: "#fff0a8", muzzle: "#ffd166" },
    visuals: { muzzleColor: "#ffe680", aura: true, auraColor: "rgba(255,209,102,0.4)", trail: true, trailColor: "rgba(255,209,102,0.55)" }
  },
  {
    id: "ghost_tank",
    name: "幽灵坦克",
    rarity: "epic",
    price: 9000,
    desc: "受击后 2 秒隐形，敌人暂时丢失目标",
    bonuses: {},
    colors: { body: "#5b8f9e", accent: "#c8f0ff", muzzle: "#9ff0ff" },
    visuals: { ghost: true, muzzleColor: "#9ff0ff", aura: true, auraColor: "rgba(159,240,255,0.35)" }
  },
  {
    id: "lava_core",
    name: "熔岩核心",
    rarity: "epic",
    price: 9500,
    desc: "子弹命中后燃烧 3 秒，每秒额外伤害",
    bonuses: {},
    colors: { body: "#b6452f", accent: "#ffc08a", muzzle: "#ff7a3c" },
    visuals: { burn: true, muzzleColor: "#ff7a3c", aura: true, auraColor: "rgba(255,122,60,0.45)", trail: true, trailColor: "rgba(255,122,60,0.5)" }
  },
  {
    id: "galaxy_phantom",
    name: "银河幻影",
    rarity: "legendary",
    price: 22000,
    desc: "全属性 +10%，移动时留下星空粒子拖尾",
    bonuses: { speed: 0.1, armor: 0.1, firepower: 0.1, bulletSpeed: 0.1, coinRate: 0.1, powerupDuration: 0.1 },
    colors: { body: "#4d3f9e", accent: "#d4c9ff", muzzle: "#b48bff" },
    visuals: { aura: true, auraColor: "rgba(180,139,255,0.5)", trail: true, trailColor: "#b48bff", shimmer: true, muzzleColor: "#d4c9ff" }
  },
  {
    id: "doom_judgement",
    name: "末日审判",
    rarity: "legendary",
    price: 26000,
    desc: "火力 +20%，护甲 +20%，速度 -10%，击杀触发爆炸波",
    bonuses: { firepower: 0.2, armor: 0.2, speed: -0.1 },
    colors: { body: "#8a2f2f", accent: "#ffd0a8", muzzle: "#ff5533" },
    visuals: { aura: true, auraColor: "rgba(255,85,51,0.5)", shimmer: true, muzzleColor: "#ff5533", killBurst: true, trail: true, trailColor: "rgba(255,85,51,0.55)" }
  }
]);

const SKIN_BY_ID = Object.freeze(
  SKIN_CONFIG.reduce((map, skin) => {
    map[skin.id] = skin;
    return map;
  }, {})
);

const RARITY_ORDER = Object.freeze({ common: 0, rare: 1, epic: 2, legendary: 3 });

const ECONOMY_CONFIG = Object.freeze({
  COIN_KEY: "steel_front_coins_v1",
  PROFILE_KEY: "steel_front_profile_v1",
  weekendMultiplier: 2,
  rewards: {
    kill: 20,
    heavyKill: 60,
    brawlerKill: 30,
    levelClear: 150,
    waveClear: 100,
    winBonus: 200,
    fragmentPerBox: 3
  },
  costs: {
    box: 1000,
    fragmentSynthesisBase: 60
  }
});

const CHECKIN_CONFIG = Object.freeze({
  days: [
    { day: 1, coins: 200, fragments: 0 },
    { day: 2, coins: 0, fragments: 5 },
    { day: 3, coins: 300, fragments: 0 },
    { day: 4, coins: 0, fragments: 0, skin: "city_camo", trialDays: 1 },
    { day: 5, coins: 400, fragments: 3 },
    { day: 6, coins: 0, fragments: 0, skin: "ghost_tank", trialDays: 2 },
    { day: 7, coins: 800, fragments: 10, box: 1 }
  ]
});

const TASK_CONFIG = Object.freeze({
  play3: { label: "完成 3 局任意模式", target: 3, coins: 300 },
  kill20: { label: "累计击杀 20 个敌人", target: 20, coins: 400 },
  classic3: { label: "经典模式通过第 3 关", target: 3, coins: 500 },
  survival10: { label: "生存模式达到第 10 波", target: 10, coins: 600 },
  brawl_kills5: { label: "乱斗模式完成 5 次击杀", target: 5, coins: 500 },
  powerup10: { label: "使用道具 10 次", target: 10, coins: 400 }
});

const ACHIEVEMENT_CONFIG = Object.freeze([
  { id: "first_game", label: "初出茅庐", desc: "完成第一局游戏", coins: 300 },
  { id: "kill_100", label: "百人斩", desc: "累计击杀 100 个敌人", skin: "red_alert" },
  { id: "survival_30", label: "生存专家", desc: "生存模式达到 30 波", skin: "lava_core" },
  { id: "collector_6", label: "坦克收藏家", desc: "拥有 6 款皮肤", coins: 5000 },
  { id: "checkin_30", label: "全勤标兵", desc: "累计签到 30 天", skin: "galaxy_phantom" },
  { id: "classic_clear", label: "通关勇士", desc: "经典模式通过第 5 关", coins: 3000 }
]);

const BOX_CONFIG = Object.freeze({
  coinMin: 400,
  coinMax: 1500,
  coinChance: 0.6,
  fragmentChance: 0.3,
  fragmentMin: 2,
  fragmentMax: 5,
  rareChance: 0.09,
  epicChance: 0.01
});

function skinFragmentCost(skin) {
  const base = ECONOMY_CONFIG.costs.fragmentSynthesisBase;
  const multiplier = { common: 1, rare: 1.6, epic: 2.5, legendary: 4 }[skin.rarity] || 1;
  return Math.round(base * multiplier);
}
