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

  function claim(input) {
    const value = String(input || "").trim();
    if (!value) {
      return { ok: false, error: "输入福利码" };
    }
    const config = findCode(value);
    if (!config) {
      return { ok: false, error: "福利码无效或已过期" };
    }
    const claimed = getClaimInfo(config);
    if (claimed) {
      return {
        ok: false,
        error: "您已领取过该福利",
        claimedAt: claimed.claimedAt || ""
      };
    }
    const rewards = config.rewards || [];
    const missing = rewards.filter((id) => !SKIN_BY_ID[id]);
    if (missing.length) {
      return { ok: false, error: "福利配置异常，请联系管理员" };
    }
    rewards.forEach((id) => {
      EconomyStore.unlockSkin(id);
    });
    const record = {
      code: config.code,
      claimedAt: new Date().toISOString(),
      rewards
    };
    localStorage.setItem(config.claimedKey, JSON.stringify(record));
    if (window.AudioFX && AudioFX.powerup) AudioFX.powerup();
    return { ok: true, config, rewards, claimedAt: record.claimedAt };
  }

  return {
    getCodes,
    findCode,
    isClaimed,
    getClaimInfo,
    claim
  };
})();
