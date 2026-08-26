/**
 * Cloud save sync backed by Supabase with local-first merge and debounce.
 */
const CloudSync = (() => {
  const SAVE_VERSION = 1;
  let debounceTimer = null;
  let lastSyncTime = null;
  let syncState = "idle";
  let applyingRemote = false;
  let syncListeners = [];
  let initialized = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function num(value) {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }

  function unionArrays(a, b) {
    const seen = {};
    const out = [];
    (a || []).concat(b || []).forEach((item) => {
      if (item && !seen[item]) {
        seen[item] = true;
        out.push(item);
      }
    });
    return out;
  }

  function mergeTrials(local, cloud) {
    const out = {};
    Object.keys(local || {}).forEach((id) => {
      out[id] = local[id];
    });
    Object.keys(cloud || {}).forEach((id) => {
      const localItem = out[id];
      const cloudItem = cloud[id];
      if (!localItem || (cloudItem && cloudItem.until > (localItem.until || 0))) {
        out[id] = cloudItem;
      }
    });
    return out;
  }

  function mergeStats(local, cloud) {
    const l = local || {};
    const c = cloud || {};
    const tankTypes = {};
    Object.keys(l.tankTypes || {}).forEach((id) => {
      tankTypes[id] = num(l.tankTypes[id]);
    });
    Object.keys(c.tankTypes || {}).forEach((id) => {
      tankTypes[id] = Math.max(tankTypes[id] || 0, num(c.tankTypes[id]));
    });
    return {
      kills: Math.max(num(l.kills), num(c.kills)),
      games: Math.max(num(l.games), num(c.games)),
      classicLevel: Math.max(num(l.classicLevel), num(c.classicLevel)),
      survivalWave: Math.max(num(l.survivalWave), num(c.survivalWave)),
      brawlWins: Math.max(num(l.brawlWins), num(c.brawlWins)),
      tankTypes
    };
  }

  function mergeLegacy(base, merged, other) {
    const legacy = clone(base.legacy || {});
    legacy.profile = legacy.profile || {};
    legacy.storage = legacy.storage || {};
    const otherLegacy = clone(other.legacy || {});
    otherLegacy.profile = otherLegacy.profile || {};
    otherLegacy.storage = otherLegacy.storage || {};

    const profile = legacy.profile;
    profile.skins = profile.skins || {};
    const owned = merged.skins.owned || [];
    owned.forEach((id) => {
      profile.skins[id] = { permanent: true };
    });
    Object.keys(merged.skins.trial || {}).forEach((id) => {
      profile.skins[id] = { until: merged.skins.trial[id].until };
    });
    profile.fragments = merged.shards;
    profile.equippedSkin = merged.equipped || profile.equippedSkin || "standard_green";
    profile.checkin = {
      lastDate: merged.checkin.lastDate || profile.checkin.lastDate || "",
      streak: Math.max(num(merged.checkin.streak), num(profile.checkin.streak)),
      totalCount: Math.max(num(merged.checkin.totalCount), num(profile.checkin.totalCount))
    };
    profile.tasks = {
      date: merged.dailyTasks.refreshDate || profile.tasks.date || "",
      progress: merged.dailyTasks.tasks || profile.tasks.progress || {},
      claimed: merged.dailyTasks.claimed || profile.tasks.claimed || {}
    };
    const claimed = {};
    (merged.achievements.unlocked || []).forEach((id) => {
      claimed[id] = true;
    });
    profile.achievements = { claimed };
    profile.completedGames = Math.max(num(merged.stats.games), num(profile.completedGames));
    profile.boxes = Math.max(num(profile.boxes), num(otherLegacy.profile.boxes));

    const storage = legacy.storage;
    storage.highScores = storage.highScores || {};
    storage.progress = storage.progress || {};
    ["classic", "survival", "brawl"].forEach((mode) => {
      storage.highScores[mode] = Math.max(
        num(storage.highScores[mode]),
        num(otherLegacy.storage.highScores && otherLegacy.storage.highScores[mode])
      );
    });
    storage.progress.classicLevel = merged.stats.classicLevel;
    storage.progress.survivalWave = merged.stats.survivalWave;
    storage.progress.brawlWins = merged.stats.brawlWins;
    storage.progress.totalKills = merged.stats.kills;
    storage.progress.tankTypesDestroyed = merged.stats.tankTypes || {};
    storage.settings = storage.settings || otherLegacy.storage.settings || {};

    return {
      storage,
      profile,
      coins: merged.coins
    };
  }

  function mergeSave(local, cloud) {
    const localTime = Date.parse(local.savedAt) || 0;
    const cloudTime = Date.parse(cloud.savedAt) || 0;
    const base = cloudTime > localTime ? cloud : local;
    const other = base === cloud ? local : cloud;
    const merged = {
      version: SAVE_VERSION,
      coins: Math.max(num(local.coins), num(cloud.coins)),
      skins: {
        owned: unionArrays(local.skins && local.skins.owned, cloud.skins && cloud.skins.owned),
        trial: mergeTrials(local.skins && local.skins.trial, cloud.skins && cloud.skins.trial)
      },
      equipped: base.equipped || other.equipped || "standard_green",
      checkin: base.checkin || other.checkin || { lastDate: "", streak: 0, totalCount: 0 },
      dailyTasks: base.dailyTasks || other.dailyTasks || { tasks: {}, claimed: {}, refreshDate: "" },
      achievements: {
        unlocked: unionArrays(
          local.achievements && local.achievements.unlocked,
          cloud.achievements && cloud.achievements.unlocked
        )
      },
      stats: mergeStats(local.stats, cloud.stats),
      shards: Math.max(num(local.shards), num(cloud.shards)),
      lastFreeBox: (cloud.lastFreeBox || local.lastFreeBox || ""),
      savedAt: new Date().toISOString()
    };
    merged.legacy = mergeLegacy(base, merged, other);
    merged.checkin = {
      signedDays: merged.checkin.signedDays || [],
      lastDate: merged.checkin.lastDate || "",
      streak: Math.max(num(merged.checkin.streak), num(other.checkin && other.checkin.streak)),
      totalCount: Math.max(num(merged.checkin.totalCount), num(other.checkin && other.checkin.totalCount))
    };
    merged.dailyTasks = {
      tasks: Object.assign({}, other.dailyTasks && other.dailyTasks.tasks, merged.dailyTasks.tasks),
      claimed: Object.assign({}, other.dailyTasks && other.dailyTasks.claimed, merged.dailyTasks.claimed),
      refreshDate: merged.dailyTasks.refreshDate || (other.dailyTasks && other.dailyTasks.refreshDate) || ""
    };
    return merged;
  }

  function buildSave() {
    const storage = SaveManager.exportData();
    const economy = EconomyStore.exportData();
    const profile = economy.profile || {};
    const progress = storage.progress || {};
    const owned = [];
    const trial = {};
    Object.keys(profile.skins || {}).forEach((id) => {
      if (profile.skins[id] && profile.skins[id].permanent) owned.push(id);
      if (profile.skins[id] && profile.skins[id].until) trial[id] = { until: profile.skins[id].until };
    });
    return {
      version: SAVE_VERSION,
      coins: economy.coins,
      skins: { owned, trial },
      equipped: profile.equippedSkin || "standard_green",
      checkin: {
        signedDays: [],
        lastDate: (profile.checkin && profile.checkin.lastDate) || "",
        streak: (profile.checkin && profile.checkin.streak) || 0,
        totalCount: (profile.checkin && profile.checkin.totalCount) || 0
      },
      dailyTasks: {
        tasks: (profile.tasks && profile.tasks.progress) || {},
        claimed: (profile.tasks && profile.tasks.claimed) || {},
        refreshDate: (profile.tasks && profile.tasks.date) || ""
      },
      achievements: {
        unlocked: Object.keys((profile.achievements && profile.achievements.claimed) || {})
      },
      stats: {
        kills: progress.totalKills || 0,
        games: profile.completedGames || 0,
        classicLevel: progress.classicLevel || 1,
        survivalWave: progress.survivalWave || 1,
        brawlWins: progress.brawlWins || 0,
        tankTypes: progress.tankTypesDestroyed || {}
      },
      shards: profile.fragments || 0,
      lastFreeBox: profile.lastFreeBox || "",
      savedAt: new Date().toISOString(),
      legacy: { storage, profile, coins: economy.coins }
    };
  }

  function applySave(save) {
    if (!save) return;
    applyingRemote = true;
    try {
      const merged = mergeSave(buildSave(), save);
      EconomyStore.importData({
        profile: merged.legacy.profile,
        coins: merged.legacy.coins
      });
      SaveManager.importData(merged.legacy.storage);
      if (window.MetaUI && MetaUI.refresh) MetaUI.refresh();
    } finally {
      applyingRemote = false;
    }
  }

  function setState(state) {
    syncState = state;
    syncListeners.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        // Ignore listener errors.
      }
    });
  }

  async function sync(force) {
    const user = SupabaseAuth.getCurrentUser();
    const client = SupabaseAuth.getClient();
    if (!user || !client) {
      setState("offline");
      return { ok: false, reason: "guest" };
    }
    if (syncState === "syncing" && !force) return { ok: false, reason: "busy" };
    setState("syncing");
    try {
      const local = buildSave();
      const { data, error } = await client
        .from("game_saves")
        .select("save_json, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        await client.from("game_saves").insert({
          user_id: user.id,
          save_json: local,
          updated_at: new Date().toISOString()
        });
      } else {
        const merged = mergeSave(local, data.save_json || {});
        applySave(merged);
        await client.from("game_saves").upsert({
          user_id: user.id,
          save_json: merged,
          updated_at: new Date().toISOString()
        });
      }
      lastSyncTime = new Date().toISOString();
      setState("success");
      return { ok: true, time: lastSyncTime };
    } catch (err) {
      setState("error");
      return { ok: false, error: err.message || "同步失败" };
    }
  }

  function scheduleSync() {
    if (applyingRemote) return;
    if (!SupabaseAuth.getCurrentUser() || !SupabaseAuth.getClient()) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      sync(false);
    }, 2000);
  }

  function exportSave() {
    const payload = JSON.stringify(buildSave(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tank-save-backup.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importSave(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("未选择文件"));
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(String(event.target.result || ""));
          if (!parsed || typeof parsed !== "object" || !parsed.legacy) {
            throw new Error("文件格式不正确，不是有效的存档文件");
          }
          if (parsed.version !== undefined && Number(parsed.version) > SAVE_VERSION) {
            throw new Error("存档版本过高，请先升级游戏后再导入");
          }
          const merged = mergeSave(buildSave(), parsed);
          applySave(merged);
          setState("success");
          resolve({ ok: true, merged });
        } catch (err) {
          setState("error");
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsText(file);
    });
  }

  function wrapEconomyMutators() {
    const mutators = [
      "addCoins",
      "spendCoins",
      "addFragments",
      "spendFragments",
      "unlockSkin",
      "equipSkin",
      "buySkin",
      "synthesizeSkin",
      "checkin",
      "recordTaskProgress",
      "claimTask",
      "claimAchievement",
      "addBoxes",
      "openBox",
      "recordGameResult"
    ];
    mutators.forEach((name) => {
      const original = EconomyStore[name];
      if (typeof original !== "function") return;
      EconomyStore[name] = function () {
        const result = original.apply(this, arguments);
        scheduleSync();
        return result;
      };
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    wrapEconomyMutators();
    SupabaseAuth.onAuthChange((user) => {
      if (user && !user.isGuest) {
        sync(true);
      } else {
        setState("offline");
      }
    });
    window.addEventListener("beforeunload", () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      sync(false);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") scheduleSync();
    });
  }

  function onSyncChange(callback) {
    syncListeners.push(callback);
    callback(syncState);
  }

  function getLastSyncTime() {
    return lastSyncTime;
  }

  function getSyncState() {
    return syncState;
  }

  function isApplyingRemote() {
    return applyingRemote;
  }

  return {
    init,
    sync,
    scheduleSync,
    exportSave,
    importSave,
    onSyncChange,
    getLastSyncTime,
    getSyncState,
    isApplyingRemote,
    buildSave
  };
})();
