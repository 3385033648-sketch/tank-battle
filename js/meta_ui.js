/**
 * 主界面元系统 UI：车库、签到、活动中心、红点与金币/碎片展示。
 */
const MetaUI = (() => {
  let game = null;
  let lastBoxResult = "";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function init(g) {
    game = g;
    document.getElementById("garageBtn").addEventListener("click", openGarage);
    document.getElementById("checkinBtn").addEventListener("click", openCheckin);
    document.getElementById("activitiesBtn").addEventListener("click", openActivities);
    document.getElementById("garageClose").addEventListener("click", closeGarage);
    document.getElementById("checkinClose").addEventListener("click", closeCheckin);
    document.getElementById("activitiesClose").addEventListener("click", closeActivities);
    renderMenuMeta();
  }

  function openGarage() {
    AudioFX.resume();
    document.getElementById("garagePanel").classList.remove("hidden");
    renderGarage();
    refresh();
  }

  function closeGarage() {
    document.getElementById("garagePanel").classList.add("hidden");
    refresh();
  }

  function openCheckin() {
    AudioFX.resume();
    document.getElementById("checkinPanel").classList.remove("hidden");
    renderCheckin();
    refresh();
  }

  function closeCheckin() {
    document.getElementById("checkinPanel").classList.add("hidden");
    refresh();
  }

  function openActivities() {
    AudioFX.resume();
    document.getElementById("activitiesPanel").classList.remove("hidden");
    renderActivities();
    refresh();
  }

  function closeActivities() {
    document.getElementById("activitiesPanel").classList.add("hidden");
    refresh();
  }

  function refresh() {
    renderMenuMeta();
    if (!document.getElementById("garagePanel").classList.contains("hidden")) renderGarage();
    if (!document.getElementById("checkinPanel").classList.contains("hidden")) renderCheckin();
    if (!document.getElementById("activitiesPanel").classList.contains("hidden")) renderActivities();
  }

  function renderMenuMeta() {
    document.getElementById("menuCoins").textContent = EconomyStore.getCoins();
    document.getElementById("menuFragments").textContent = EconomyStore.getFragments();
    const skin = EconomyStore.getActiveSkin();
    document.getElementById("menuSkin").textContent = skin.name;
    const mini = document.getElementById("menuTankMini");
    mini.style.background = skin.colors.body;
    mini.style.boxShadow = "0 0 10px " + skin.colors.accent;
    updateRedDots();
  }

  function updateRedDots() {
    const checkinDot = document.getElementById("checkinBtn").querySelector(".red-dot");
    const activitiesDot = document.getElementById("activitiesBtn").querySelector(".red-dot");
    const garageDot = document.getElementById("garageBtn").querySelector(".red-dot");

    checkinDot.classList.toggle("hidden", !EconomyStore.canCheckin());
    activitiesDot.classList.toggle("hidden", !EconomyStore.hasActivityDot());

    const canAffordSomething = SKIN_CONFIG.some((skin) => {
      if (EconomyStore.getSkinStatus(skin.id) !== "locked") return false;
      return EconomyStore.getCoins() >= skin.price || EconomyStore.getFragments() >= skinFragmentCost(skin);
    });
    garageDot.classList.toggle("hidden", !canAffordSomething);
  }

  function rarityName(rarity) {
    return { common: "普通", rare: "稀有", epic: "史诗", legendary: "传说" }[rarity] || rarity;
  }

  function bonusText(bonuses) {
    const labels = {
      speed: "速度",
      armor: "护甲",
      firepower: "火力",
      bulletSpeed: "弹速",
      coinRate: "金币获取",
      powerupDuration: "道具时长"
    };
    const parts = Object.keys(bonuses).map((key) => {
      const value = bonuses[key] * 100;
      return labels[key] + (value >= 0 ? "+" : "") + value + "%";
    });
    return parts.join(" · ") || "无属性加成";
  }

  function renderGarage() {
    const container = document.getElementById("garageContent");
    container.innerHTML = "";
    const grid = el("div", "garage-grid");

    SKIN_CONFIG.forEach((skin) => {
      const status = EconomyStore.getSkinStatus(skin.id);
      const active = EconomyStore.getActiveSkin().id === skin.id && status !== "locked";
      const card = el("div", "skin-card rarity-" + skin.rarity + (active ? " equipped" : ""));

      const rarity = el("span", "rarity-label", rarityName(skin.rarity));
      const swatch = el("div", "skin-swatch");
      swatch.style.background = "linear-gradient(135deg, " + skin.colors.body + " 0%, #111823 90%)";
      const mini = el("span", "mini-tank");
      mini.style.background = skin.colors.body;
      mini.style.boxShadow = "0 0 14px " + skin.colors.accent;
      swatch.appendChild(mini);

      const name = el("div", "skin-name", skin.name);
      const desc = el("div", "skin-desc", skin.desc);
      const stats = el("div", "skin-stats", bonusText(skin.bonuses));

      card.appendChild(rarity);
      card.appendChild(swatch);
      card.appendChild(name);
      card.appendChild(desc);
      card.appendChild(stats);

      if (status === "owned") {
        const button = el(
          "button",
          "btn-small" + (active ? " secondary" : ""),
          active ? "已装备" : "装备"
        );
        if (!active) {
          button.addEventListener("click", () => {
            EconomyStore.equipSkin(skin.id);
            AudioFX.buy();
            renderGarage();
            refresh();
          });
        } else {
          button.disabled = true;
        }
        card.appendChild(button);
      } else if (status === "trial") {
        const button = el("button", "btn-small", active ? "使用中" : "装备");
        if (!active) {
          button.addEventListener("click", () => {
            EconomyStore.equipSkin(skin.id);
            AudioFX.buy();
            renderGarage();
            refresh();
          });
        } else {
          button.disabled = true;
        }
        const trial = el("span", "trial-time", "体验卡剩余 " + formatTrial(EconomyStore.trialSecondsLeft(skin.id)));
        card.appendChild(button);
        card.appendChild(trial);
      } else {
        const affordable = EconomyStore.getCoins() >= skin.price;
        const button = el("button", "btn-small", "购买 " + skin.price + " 金币");
        button.disabled = !affordable;
        button.addEventListener("click", () => {
          const result = EconomyStore.buySkin(skin.id);
          if (result.ok) {
            renderGarage();
            refresh();
          }
        });
        card.appendChild(button);
      }

      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  function formatTrial(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return days + " 天 " + hours + " 小时";
    return Math.ceil(seconds / 3600) + " 小时";
  }

  function rewardText(reward) {
    const parts = [];
    if (reward.coins) parts.push(reward.coins + " 金币");
    if (reward.fragments) parts.push(reward.fragments + " 碎片");
    if (reward.skin) {
      const skin = SKIN_BY_ID[reward.skin];
      parts.push(skin.name + (reward.trialDays ? " ×" + reward.trialDays + "天" : ""));
    }
    if (reward.box) parts.push("宝箱 ×" + reward.box);
    return parts.join(" + ");
  }

  function renderCheckin() {
    const container = document.getElementById("checkinContent");
    container.innerHTML = "";
    const info = EconomyStore.getCheckinInfo();
    const claimedToday = !info.can;

    const grid = el("div", "checkin-grid");
    CHECKIN_CONFIG.days.forEach((day, index) => {
      const cell = el("div", "checkin-day");
      if (index === info.dayIndex && info.can) cell.classList.add("today");
      const cyclePos = ((info.streak - 1) % 7) + (claimedToday ? 1 : 0);
      if (index < cyclePos) cell.classList.add("claimed");
      cell.appendChild(el("b", "", "第 " + day.day + " 天"));
      cell.appendChild(el("span", "", rewardText(day)));
      grid.appendChild(cell);
    });
    container.appendChild(grid);

    const status = el("div", "checkin-status", "连续签到 " + info.streak + " 天 · 累计 " + info.totalCount + " 天");
    container.appendChild(status);

    const buttonRow = el("div", "button-row");
    const claim = el("button", "primary-btn", info.can ? "立即签到" : "今日已签到");
    claim.disabled = !info.can;
    claim.addEventListener("click", () => {
      const result = EconomyStore.checkin();
      if (result) {
        status.textContent = "签到成功：第 " + (result.dayIndex + 1) + " 天奖励已领取";
        renderCheckin();
        refresh();
      }
    });
    buttonRow.appendChild(claim);
    container.appendChild(buttonRow);
  }

  function renderActivities() {
    const container = document.getElementById("activitiesContent");
    container.innerHTML = "";

    if (EconomyStore.isWeekend()) {
      container.appendChild(el("div", "weekend-badge", "周末双倍：本日游戏金币收益 ×2"));
    } else {
      container.appendChild(el("div", "weekend-badge", "周末双倍：周六/周日游戏金币收益 ×2"));
    }

    const taskSection = el("section", "activity-section");
    taskSection.appendChild(el("h3", "", "每日任务"));
    Object.keys(TASK_CONFIG).forEach((id) => {
      const task = EconomyStore.getTaskStatus(id);
      const row = el("div", "task-row");
      row.appendChild(el("span", "", task.label + "（" + task.progress + "/" + task.target + "）"));
      row.appendChild(el("b", "", task.coins + " 金币"));
      const claim = el("button", "btn-small" + (task.claimed ? " secondary" : ""), task.claimed ? "已领取" : task.done ? "领取" : "进行中");
      claim.disabled = !task.done || task.claimed;
      claim.addEventListener("click", () => {
        EconomyStore.claimTask(id);
        renderActivities();
        refresh();
      });
      row.appendChild(claim);
      const bar = el("div", "progress-bar");
      const fill = el("i", "");
      fill.style.width = Math.min(100, (task.progress / task.target) * 100) + "%";
      bar.appendChild(fill);
      row.appendChild(bar);
      taskSection.appendChild(row);
    });
    container.appendChild(taskSection);

    const achievementSection = el("section", "activity-section");
    achievementSection.appendChild(el("h3", "", "成就"));
    ACHIEVEMENT_CONFIG.forEach((config) => {
      const status = EconomyStore.getAchievementStatus(config.id);
      const row = el("div", "achievement-row");
      row.appendChild(el("span", "", status.label + "：" + status.desc));
      const rewardLabel = status.skin ? SKIN_BY_ID[status.skin].name : status.coins + " 金币";
      row.appendChild(el("b", "", rewardLabel));
      const claim = el("button", "btn-small" + (status.claimed ? " secondary" : ""), status.claimed ? "已领取" : status.done ? "领取" : "未达成");
      claim.disabled = !status.done || status.claimed;
      claim.addEventListener("click", () => {
        EconomyStore.claimAchievement(config.id);
        renderActivities();
        refresh();
      });
      row.appendChild(claim);
      achievementSection.appendChild(row);
    });
    container.appendChild(achievementSection);

    const synthesisSection = el("section", "activity-section");
    synthesisSection.appendChild(el("h3", "", "皮肤碎片合成"));
    const fragments = EconomyStore.getFragments();
    const locked = SKIN_CONFIG.filter((skin) => EconomyStore.getSkinStatus(skin.id) === "locked");
    const synthRow = el("div", "synthesis-row");
    synthRow.appendChild(el("span", "", "当前碎片：" + fragments));
    const select = el("select");
    locked.forEach((skin) => {
      const option = el("option", "", skin.name + " · " + skinFragmentCost(skin) + " 碎片");
      option.value = skin.id;
      select.appendChild(option);
    });
    const synthBtn = el("button", "btn-small", "合成皮肤");
    synthBtn.disabled = locked.length === 0 || fragments < skinFragmentCost(locked[0]);
    synthBtn.addEventListener("click", () => {
      const target = locked.find((skin) => skin.id === select.value) || locked[0];
      if (!target) return;
      EconomyStore.synthesizeSkin(target.id);
      renderActivities();
      refresh();
    });
    if (locked.length) synthRow.appendChild(select);
    synthRow.appendChild(synthBtn);
    synthesisSection.appendChild(synthRow);
    container.appendChild(synthesisSection);

    const boxSection = el("section", "activity-section");
    boxSection.appendChild(el("h3", "", "神秘宝箱"));
    const boxRow = el("div", "box-panel");
    const info = el(
      "span",
      "",
      "拥有宝箱：" + EconomyStore.getBoxes() + " · 购买价格：" + ECONOMY_CONFIG.costs.box + " 金币"
    );
    const openBtn = el("button", "primary-btn", "开启宝箱");
    openBtn.disabled = !EconomyStore.canOpenBox();
    openBtn.addEventListener("click", () => {
      const result = EconomyStore.openBox();
      if (result) {
        lastBoxResult = result.label + "：" + result.detail;
      }
      renderActivities();
      refresh();
    });
    boxRow.appendChild(info);
    boxRow.appendChild(openBtn);
    boxSection.appendChild(boxRow);
    if (lastBoxResult) boxSection.appendChild(el("div", "checkin-status", "上次开箱：" + lastBoxResult));
    container.appendChild(boxSection);
  }

  return {
    init,
    bind: init,
    refresh,
    renderMenuMeta
  };
})();
