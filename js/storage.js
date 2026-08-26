/**
 * LocalStorage storage: high scores, unlocks, progress and settings.
 */
const SaveManager = (() => {
  const DEFAULTS = {
    version: 1,
    highScores: {
      classic: 0,
      survival: 0,
      brawl: 0
    },
    progress: {
      classicLevel: 1,
      survivalWave: 1,
      brawlWins: 0,
      totalKills: 0,
      tankTypesDestroyed: {}
    },
    settings: {
      sound: true,
      music: true,
      shake: true,
      particles: true,
      contrast: false
    }
  };

  let data = null;

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

  function load() {
    if (data) return data;
    try {
      const raw = localStorage.getItem(GameConfig.STORAGE_KEY);
      data = raw ? deepMerge(DEFAULTS, JSON.parse(raw)) : deepMerge(DEFAULTS, {});
    } catch (err) {
      data = deepMerge(DEFAULTS, {});
    }
    return data;
  }

  function save() {
    try {
      localStorage.setItem(GameConfig.STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      // Ignore storage limits.
    }
    if (window.CloudSync && window.CloudSync.isApplyingRemote && !window.CloudSync.isApplyingRemote()) {
      window.CloudSync.scheduleSync();
    }
  }

  function get(path, fallback) {
    const parts = path.split(".");
    let node = load();
    for (let i = 0; i < parts.length; i++) {
      if (node == null) return fallback;
      node = node[parts[i]];
    }
    return node === undefined ? fallback : node;
  }

  function set(path, value) {
    const parts = path.split(".");
    let node = load();
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]] || typeof node[parts[i]] !== "object") {
        node[parts[i]] = {};
      }
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
    save();
  }

  function update(patch) {
    data = deepMerge(load(), patch);
    save();
  }

  function submitScore(mode, score, extra) {
    const record = load();
    const high = record.highScores[mode];
    const isRecord = score > high;
    if (isRecord) {
      record.highScores[mode] = score;
    }
    if (mode === "classic") {
      record.progress.classicLevel = Math.max(record.progress.classicLevel, extra);
    } else if (mode === "survival") {
      record.progress.survivalWave = Math.max(record.progress.survivalWave, extra);
    } else if (mode === "brawl" && extra > 0) {
      record.progress.brawlWins = (record.progress.brawlWins || 0) + 1;
    }
    save();
    return { isRecord, high: Math.max(high, score) };
  }

  function addKills(count, tankTypes) {
    const record = load();
    record.progress.totalKills = (record.progress.totalKills || 0) + count;
    if (tankTypes) {
      Object.keys(tankTypes).forEach((key) => {
        record.progress.tankTypesDestroyed[key] =
          (record.progress.tankTypesDestroyed[key] || 0) + tankTypes[key];
      });
    }
    save();
  }

  function getSettings() {
    return load().settings;
  }

  function updateSettings(patch) {
    data = load();
    data.settings = { ...data.settings, ...patch };
    save();
  }

  function exportData() {
    return JSON.parse(JSON.stringify(load()));
  }

  function importData(incoming) {
    data = deepMerge(DEFAULTS, incoming || {});
    save();
    return data;
  }

  return {
    load,
    save,
    get,
    set,
    update,
    submitScore,
    addKills,
    getSettings,
    updateSettings,
    exportData,
    importData
  };
})();
