/**
 * Reward code redemption panel.
 */
const RewardPanel = (() => {
  let inited = false;

  function el(id) {
    return document.getElementById(id);
  }

  function showMessage(text, isError) {
    const node = el("rewardMessage");
    node.textContent = text;
    node.classList.toggle("error", !!isError);
    node.classList.toggle("success", !isError);
  }

  function renderHistory() {
    const container = el("rewardHistory");
    if (!container) return;
    container.innerHTML = "";
    RewardCodeSystem.getCodes().forEach((item) => {
      const row = document.createElement("div");
      row.className = "reward-history-row";
      const name = document.createElement("span");
      name.textContent = item.name;
      const info = document.createElement("span");
      const claimed = RewardCodeSystem.getClaimInfo(item);
      if (claimed) {
        info.className = "reward-claimed";
        info.textContent = "已领取 " + new Date(claimed.claimedAt).toLocaleDateString("zh-CN");
      } else {
        info.className = "reward-pending";
        info.textContent = "未领取";
      }
      row.appendChild(name);
      row.appendChild(info);
      container.appendChild(row);
    });
  }

  function open() {
    el("rewardPanel").classList.remove("hidden");
    el("rewardCodeInput").value = "";
    showMessage("", false);
    renderHistory();
  }

  function close() {
    el("rewardPanel").classList.add("hidden");
  }

  function handleClaim() {
    const input = el("rewardCodeInput").value;
    const result = RewardCodeSystem.claim(input);
    if (!result.ok) {
      showMessage(result.error, true);
      renderHistory();
      return;
    }
    const names = result.rewards
      .map((id) => (SKIN_BY_ID[id] ? SKIN_BY_ID[id].name : id))
      .join("、");
    showMessage("领取成功：" + names, false);
    renderHistory();
  }

  function ensureUI() {
    if (el("rewardBtn")) return;
    const container = document.querySelector(".feature-actions");
    if (!container) return;
    const button = document.createElement("button");
    button.type = "button";
    button.id = "rewardBtn";
    button.className = "feature-btn";
    button.innerHTML = '<span class="feature-icon">✦</span><span>福利兑换</span>';
    container.insertBefore(button, document.getElementById("settingsBtn"));

    const panel = document.createElement("section");
    panel.id = "rewardPanel";
    panel.className = "overlay hidden";
    panel.setAttribute("aria-label", "福利兑换");
    panel.innerHTML =
      '<div class="panel reward-panel">' +
      '<div class="panel-head"><h2>福利兑换</h2><button class="panel-close" id="rewardClose" type="button">×</button></div>' +
      '<p class="reward-desc">输入福利码，领取专属奖励</p>' +
      '<input id="rewardCodeInput" class="reward-input" type="text" placeholder="请输入福利码">' +
      '<button id="rewardClaimBtn" class="primary-btn" type="button">领取</button>' +
      '<p id="rewardMessage" class="auth-message"></p>' +
      '<div id="rewardHistory" class="reward-history"></div>' +
      '</div>';
    document.body.appendChild(panel);
  }

  function init() {
    if (inited) return;
    inited = true;
    ensureUI();
    el("rewardBtn").addEventListener("click", open);
    el("rewardClose").addEventListener("click", close);
    el("rewardClaimBtn").addEventListener("click", handleClaim);
    el("rewardCodeInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") handleClaim();
    });
  }

  return {
    init,
    open,
    close
  };
})();
