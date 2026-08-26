/**
 * 经济与元进度存档：金币、碎片、皮肤、签到、每日任务、成就、宝箱。
 * 金币使用独立 key，皮肤/任务等使用 PROFILE_KEY，旧存档缺失字段时自动补默认值。
 */
const EconomyStore = (() => {
  const PROFILE_DEFAULTS = {
    version: 1,
    fragments: 0,
    equippedSkin: "standard_green",
    skins: {
      standard_green: { permanent: true }
    },
    checkin: {
      lastDate: "",
      streak: 0,
      totalCount: 0
    },
    tasks: {
      date: "",
      progress: {},
      claimed: {}
    },
    achievements: {
      claimed: {}
    },
    completedGames: 0,
    boxes: 0
  };

  let profile = null;
  let coinData = null;

  function deepMerge(base, incoming) {
    const out = Array.isArray(base) ? base.slice() : { ...base };
    if (!incoming || typeof incoming !== "object") return out;
    Object.keys(incoming).forEach((key) => {
      if (
        incoming[key] &&
        typeof incoming[key] === "object" &&
        !Array.isArray(incoming[key]) &&
        base[key] &&
        typeof base[key] === "object"
      ) {
        out[key] = deepMerge(base[key], incoming[key]);
      } else if (incoming[key] !== undefined) {
        out[key] = incoming[key];
      }
    });
    return out;
  }

  function loadProfile() {
    if (profile) return profile;
    try {
      const raw = localStorage.getItem(GameConfig.PROFILE_KEY);
      profile = raw ? deepMerge(PROFILE_DEFAULTS, JSON.parse(raw)) : deepMerge(PROFILE_DEFAULTS, {});
    } catch (err) {
      profile = deepMerge(PROFILE_DEFAULTS, {});
    }
    pruneTrials(true);
    return profile;
  }

  function saveProfile() {
    try {
      localStorage.setItem(GameConfig.PROFILE_KEY, JSON.stringify(profile));
    } catch (err) {
      // 存储受限时静默降级
    }
  }

  function loadCoins() {
    if (coinData) return coinData;
    try {
      const raw = localStorage.getItem(GameConfig.COIN_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      coinData = {
        coins: Number.isFinite(parsed.coins) ? Math.max(0, Math.floor(parsed.coins)) : 0
      };
    } catch (err) {
      coinData = { coins: 0 };
    }
    return coinData;
  }

  function saveCoins() {
    try {
      localStorage.setItem(GameConfig.COIN_KEY, JSON.stringify(coinData));
    } catch (err) {
      // 存储受限时静默降级
    }
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function dateKeyOffset(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function isWeekend() {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  }

  function getCoins() {
    return loadCoins().coins;
  }

  function addCoins(amount, applyWeekend) {
    const data = loadCoins();
    let value = Math.max(0, Math.floor(amount));
    if (applyWeekend && isWeekend()) value *= ECONOMY_CONFIG.weekendMultiplier;
    data.coins += value;
    saveCoins();
    return value;
  }

  function spendCoins(amount) {
    const data = loadCoins();
    const cost = Math.floor(amount);
    if (data.coins < cost) return false;
    data.coins -= cost;
    saveCoins();
    return true;
  }

  function getFragments() {
    return loadProfile().fragments || 0;
  }

  function addFragments(amount) {
    profile.fragments = Math.max(0, (profile.fragments || 0) + Math.floor(amount));
    saveProfile();
  }

  function spendFragments(amount) {
    if (getFragments() < amount) return false;
    profile.fragments -= amount;
    saveProfile();
    return true;
  }

  function pruneTrials(silent) {
    if (!profile) return;
    let changed = false;
    Object.keys(profile.skins || {}).forEach((id) => {
      const item = profile.skins[id];
      if (item && item.until && item.until <= Date.now()) {
        delete profile.skins[id];
        changed = true;
      }
    });
    if (changed && !silent) saveProfile();
  }

  function ownedSkin(id) {
    loadProfile();
    pruneTrials(false);
    const item = profile.skins[id];
    return !!item && !!item.permanent;
  }

  function hasTrial(id) {
    loadProfile();
    pruneTrials(false);
    const item = profile.skins[id];
    return !!item && !!item.until && item.until > Date.now();
  }

  function getSkinStatus(id) {
    if (ownedSkin(id)) return "owned";
    if (hasTrial(id)) return "trial";
    return "locked";
  }

  function trialSecondsLeft(id) {
    const item = profile.skins[id];
    if (!item || !item.until) return 0;
    return Math.max(0, Math.ceil((item.until - Date.now()) / 1000));
  }

  function unlockSkin(id, opts) {
    loadProfile();
    const options = opts || {};
    if (options.until) {
      profile.skins[id] = { until: options.until };
    } else {
      profile.skins[id] = { permanent: true };
    }
    saveProfile();
  }

  function getActiveSkin() {
    loadProfile();
    pruneTrials(false);
    const equipped = profile.equippedSkin;
    if (SKIN_BY_ID[equipped] && (ownedSkin(equipped) || hasTrial(equipped))) {
      return SKIN_BY_ID[equipped];
    }
    profile.equippedSkin = "standard_green";
    saveProfile();
    return SKIN_BY_ID.standard_green;
  }

  function equipSkin(id) {
    if (!ownedSkin(id) && !hasTrial(id)) return false;
    profile.equippedSkin = id;
    saveProfile();
    return true;
  }

  function buySkin(id) {
    const skin = SKIN_BY_ID[id];
    if (!skin || ownedSkin(id)) return { ok: false, reason: "owned" };
    if (!spendCoins(skin.price)) return { ok: false, reason: "coins" };
    unlockSkin(id);
    AudioFX.buy();
    return { ok: true, skin };
  }

  function synthesizeSkin(id) {
    const skin = SKIN_BY_ID[id];
    if (!skin || ownedSkin(id) || hasTrial(id)) return { ok: false, reason: "owned" };
    const cost = skinFragmentCost(skin);
    if (!spendFragments(cost)) return { ok: false, reason: "fragments" };
    unlockSkin(id);
    AudioFX.unlock();
    return { ok: true, skin };
  }

  function applySkinStats(base) {
    const skin = getActiveSkin();
    const b = skin.bonuses || {};
    return {
      skin,
      speed: base.speed * (1 + (b.speed || 0)),
      bulletSpeed: base.bulletSpeed * (1 + (b.bulletSpeed || 0)),
      bulletDamage: base.bulletDamage * (1 + (b.firepower || 0)),
      fireInterval: Math.max(0.16, base.fireInterval * (1 - (b.firepower || 0) * 0.5)),
      armor: 1 + (b.armor || 0),
      coinRate: 1 + (b.coinRate || 0),
      powerupDuration: 1 + (b.powerupDuration || 0)
    };
  }

  function canCheckin() {
    loadProfile();
    return profile.checkin.lastDate !== todayKey();
  }

  function getCheckinInfo() {
    loadProfile();
    const can = canCheckin();
    let streak = profile.checkin.streak;
    if (can) {
      streak = profile.checkin.lastDate === dateKeyOffset(-1) ? streak + 1 : 1;
    }
    const dayIndex = (Math.max(0, streak - 1)) % CHECKIN_CONFIG.days.length;
    return {
      can,
      streak,
      dayIndex,
      totalCount: profile.checkin.totalCount,
      reward: CHECKIN_CONFIG.days[dayIndex]
    };
  }

  function checkin() {
    loadProfile();
    if (!canCheckin()) return null;
    const info = getCheckinInfo();
    profile.checkin.lastDate = todayKey();
    profile.checkin.streak = info.streak;
    profile.checkin.totalCount++;
    applyReward(info.reward);
    saveProfile();
    AudioFX.checkin();
    return info;
  }

  function applyReward(reward) {
    if (!reward) return;
    if (reward.coins) addCoins(reward.coins, false);
    if (reward.fragments) addFragments(reward.fragments);
    if (reward.box) profile.boxes += reward.box;
    if (reward.skin) {
      if (ownedSkin(reward.skin) || hasTrial(reward.skin)) {
        addFragments(20);
      } else {
        unlockSkin(reward.skin, { until: Date.now() + (reward.trialDays || 1) * 86400000 });
      }
    }
  }

  function ensureDailyTasks() {
    loadProfile();
    if (profile.tasks.date !== todayKey()) {
      profile.tasks = { date: todayKey(), progress: {}, claimed: {} };
      saveProfile();
    }
  }

  function recordTaskProgress(id, amount) {
    ensureDailyTasks();
    const task = TASK_CONFIG[id];
    if (!task || profile.tasks.claimed[id]) return;
    const current = profile.tasks.progress[id] || 0;
    profile.tasks.progress[id] = Math.min(task.target, current + Math.floor(amount));
    saveProfile();
  }

  function getTaskStatus(id) {
    ensureDailyTasks();
    const task = TASK_CONFIG[id];
    const progress = profile.tasks.progress[id] || 0;
    const claimed = !!profile.tasks.claimed[id];
    return { id, ...task, progress, claimed, done: progress >= task.target };
  }

  function getClaimableTasks() {
    return Object.keys(TASK_CONFIG)
      .map((id) => getTaskStatus(id))
      .filter((task) => task.done && !task.claimed);
  }

  function claimTask(id) {
    ensureDailyTasks();
    const status = getTaskStatus(id);
    if (!status.done || status.claimed) return null;
    profile.tasks.claimed[id] = true;
    addCoins(status.coins, false);
    saveProfile();
    AudioFX.taskDone();
    return status;
  }

  function ownedSkinCount() {
    return SKIN_CONFIG.filter((skin) => ownedSkin(skin.id) || hasTrial(skin.id)).length;
  }

  function getAchievementStatus(id) {
    const config = ACHIEVEMENT_CONFIG.find((item) => item.id === id);
    const progress = SaveManager.get("progress", {});
    let done = false;
    if (id === "first_game") done = loadProfile().completedGames >= 1;
    else if (id === "kill_100") done = (progress.totalKills || 0) >= 100;
    else if (id === "survival_30") done = (progress.survivalWave || 1) >= 30;
    else if (id === "collector_6") done = ownedSkinCount() >= 6;
    else if (id === "checkin_30") done = loadProfile().checkin.totalCount >= 30;
    else if (id === "classic_clear") done = (progress.classicLevel || 1) >= 5;
    return {
      ...config,
      done,
      claimed: !!profile.achievements.claimed[id]
    };
  }

  function getClaimableAchievements() {
    loadProfile();
    return ACHIEVEMENT_CONFIG.map((item) => getAchievementStatus(item.id)).filter(
      (item) => item.done && !item.claimed
    );
  }

  function claimAchievement(id) {
    loadProfile();
    const status = getAchievementStatus(id);
    if (!status.done || status.claimed) return null;
    profile.achievements.claimed[id] = true;
    if (status.coins) {
      addCoins(status.coins, false);
    }
    if (status.skin) {
      if (ownedSkin(status.skin) || hasTrial(status.skin)) {
        addFragments(50);
      } else {
        unlockSkin(status.skin);
      }
    }
    saveProfile();
    AudioFX.achievement();
    return status;
  }

  function getBoxes() {
    return loadProfile().boxes || 0;
  }

  function addBoxes(count) {
    profile.boxes += Math.floor(count);
    saveProfile();
  }

  function canOpenBox() {
    return getBoxes() > 0 || getCoins() >= ECONOMY_CONFIG.costs.box;
  }

  function rollBox() {
    const roll = Math.random();
    if (roll < BOX_CONFIG.coinChance) {
      const coins = Utils.randomInt(BOX_CONFIG.coinMin, BOX_CONFIG.coinMax);
      addCoins(coins, false);
      return { type: "coins", label: "金币", detail: "+" + coins + " 金币" };
    }
    if (roll < BOX_CONFIG.coinChance + BOX_CONFIG.fragmentChance) {
      const fragments = Utils.randomInt(BOX_CONFIG.fragmentMin, BOX_CONFIG.fragmentMax);
      addFragments(fragments);
      return { type: "fragments", label: "皮肤碎片", detail: "+" + fragments + " 碎片" };
    }
    const rarity = roll < BOX_CONFIG.coinChance + BOX_CONFIG.fragmentChance + BOX_CONFIG.rareChance ? "rare" : "epic";
    const candidates = SKIN_CONFIG.filter((skin) => skin.rarity === rarity && !ownedSkin(skin.id) && !hasTrial(skin.id));
    if (candidates.length) {
      const skin = Utils.pick(candidates);
      unlockSkin(skin.id);
      return { type: "skin", label: skin.rarity === "epic" ? "史诗皮肤" : "稀有皮肤", detail: skin.name + " 已解锁", skin: skin.id };
    }
    addCoins(1200, false);
    return { type: "coins", label: "金币", detail: "+1200 金币" };
  }

  function openBox() {
    loadProfile();
    if (getBoxes() > 0) {
      profile.boxes--;
    } else if (spendCoins(ECONOMY_CONFIG.costs.box)) {
      // 已扣金币
    } else {
      return null;
    }
    const result = rollBox();
    saveProfile();
    AudioFX.boxOpen();
    return result;
  }

  function recordGameResult(mode, kills, extra, won) {
    loadProfile();
    profile.completedGames++;
    recordTaskProgress("play3", 1);
    recordTaskProgress("kill20", kills);
    if (mode === "classic") recordTaskProgress("classic3", Math.max(0, extra));
    if (mode === "survival") recordTaskProgress("survival10", Math.max(0, extra));
    if (mode === "brawl") recordTaskProgress("brawl_kills5", kills);
    saveProfile();
  }

  function hasActivityDot() {
    return (
      getClaimableTasks().length > 0 ||
      getClaimableAchievements().length > 0 ||
      canOpenBox()
    );
  }

  function exportData() {
    return {
      profile: JSON.parse(JSON.stringify(loadProfile())),
      coins: getCoins()
    };
  }

  function importData(payload) {
    profile = deepMerge(PROFILE_DEFAULTS, (payload && payload.profile) || {});
    coinData = { coins: Math.max(0, Math.floor((payload && payload.coins) || 0)) };
    pruneTrials(true);
    saveProfile();
    saveCoins();
    return { profile, coins: coinData.coins };
  }

  return {
    getCoins,
    addCoins,
    spendCoins,
    getFragments,
    addFragments,
    spendFragments,
    ownedSkin,
    hasTrial,
    getSkinStatus,
    trialSecondsLeft,
    unlockSkin,
    getActiveSkin,
    equipSkin,
    buySkin,
    synthesizeSkin,
    applySkinStats,
    canCheckin,
    getCheckinInfo,
    checkin,
    recordTaskProgress,
    getTaskStatus,
    getClaimableTasks,
    claimTask,
    getAchievementStatus,
    getClaimableAchievements,
    claimAchievement,
    getBoxes,
    addBoxes,
    canOpenBox,
    openBox,
    recordGameResult,
    hasActivityDot,
    exportData,
    importData,
    isWeekend,
    skinFragmentCost
  };
})();
