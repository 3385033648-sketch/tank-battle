/**
 * Reward code redemption backed by localStorage claim keys.
 */
const RewardCodeSystem = (() => {
  function getCodes() {
    return (GameConfig.REWARD_CODE_CONFIG && GameConfig.REWARD_CODE_CONFIG.codes) || [];
  }

  function findCode(input) {
    const value = String(input || "").trim().toLowerCase();
    return getCodes().find((item) => String(item.code).toLowerCase() === value) || null;
  }

  function getClaimInfo(codeConfig) {
    if (!codeConfig || !codeConfig.claimedKey) return null;
    try {
      return JSON.parse(localStorage.getItem(codeConfig.claimedKey) || "null");
    } catch (err) {
      return null;
    }
  }

  function isClaimed(codeConfig) {
    return !!getClaimInfo(codeConfig);
  }

  function getRewardIds(config) {
    if (config.rewards === "ALL") return Object.keys(SKIN_BY_ID);
    return config.rewards || [];
  }

  function claim(input) {
    const value = String(input || "").trim();
    if (!value) {
      return { ok: false, error: "输入福利码" };
    }
    const config = findCode(value);
    if (!config) {
      return { ok: false, error: "福利码无效或已过期" };
    }
    const rewardIds = getRewardIds(config);
    const missing = rewardIds.filter((id) => !SKIN_BY_ID[id]);
    if (missing.length) {
      return { ok: false, error: "福利配置异常，请联系管理员" };
    }
    const claimed = getClaimInfo(config);
    if (claimed) {
      // 已领取过：若奖励皮肤仍有缺失（历史存档损坏/试用过期），自动补发
      let recovered = false;
      rewardIds.forEach((id) => {
        if (!EconomyStore.ownedSkin(id)) {
          EconomyStore.unlockSkin(id);
          recovered = true;
        }
      });
      if (recovered) {
        return { ok: true, config, rewards: rewardIds, recovered: true, claimedAt: claimed.claimedAt || "" };
      }
      return {
        ok: false,
        error: "您已领取过该福利",
        claimedAt: claimed.claimedAt || ""
      };
    }
    rewardIds.forEach((id) => {
      EconomyStore.unlockSkin(id);
    });
    const record = {
      code: config.code,
      claimedAt: new Date().toISOString(),
      rewards: rewardIds
    };
    localStorage.setItem(config.claimedKey, JSON.stringify(record));
    if (window.AudioFX && AudioFX.powerup) AudioFX.powerup();
    return { ok: true, config, rewards: rewardIds, claimedAt: record.claimedAt };
  }

  function reconcile() {
    let changed = false;
    getCodes().forEach((config) => {
      const claimed = getClaimInfo(config);
      if (!claimed) return;
      const rewardIds = getRewardIds(config);
      rewardIds.forEach((id) => {
        if (SKIN_BY_ID[id] && !EconomyStore.ownedSkin(id)) {
          EconomyStore.unlockSkin(id);
          changed = true;
        }
      });
    });
    return changed;
  }

  return {
    getCodes,
    findCode,
    isClaimed,
    getClaimInfo,
    claim,
    reconcile
  };
})();
