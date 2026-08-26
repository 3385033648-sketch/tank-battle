/**
 * Account status badge shown in the top-right corner.
 */
const UserBadge = (() => {
  let inited = false;
  let currentUser = null;

  function el(id) {
    return document.getElementById(id);
  }

  function syncLabel() {
    const time = CloudSync.getLastSyncTime();
    if (!time) return "尚未同步";
    const date = new Date(time);
    return "上次同步 " + date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  function createFileInput() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";
    document.body.appendChild(input);
    return input;
  }

  function importFromFile(input) {
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    CloudSync.importSave(file).then((result) => {
      alert("导入成功！金币、皮肤、进度已合并到当前存档。");
      render();
      if (window.MetaUI && MetaUI.refresh) MetaUI.refresh();
    }).catch((err) => {
      alert("导入失败：" + (err && err.message ? err.message : "文件无法识别"));
    });
  }

  function appendSaveButtons(menu) {
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "user-menu-item";
    exportBtn.textContent = "导出存档";
    exportBtn.addEventListener("click", () => {
      menu.classList.add("hidden");
      CloudSync.exportSave();
    });
    menu.appendChild(exportBtn);

    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "user-menu-item";
    importBtn.textContent = "导入存档";
    importBtn.addEventListener("click", () => {
      menu.classList.add("hidden");
      const input = createFileInput();
      input.addEventListener("change", () => {
        importFromFile(input);
        input.remove();
      });
      input.click();
    });
    menu.appendChild(importBtn);
  }

  function buildMenu() {
    const menu = document.createElement("div");
    menu.className = "user-menu hidden";
    return menu;
  }

  function render() {
    const container = el("userBadge");
    if (!container) return;
    container.innerHTML = "";
    currentUser = SupabaseAuth.getDisplayUser();

    if (currentUser.isGuest) {
      const badge = document.createElement("div");
      badge.className = "user-badge-main guest-badge";

      const icon = document.createElement("span");
      icon.className = "user-avatar";
      icon.textContent = "存";

      const label = document.createElement("span");
      label.className = "user-label";
      label.textContent = "存档";

      badge.appendChild(icon);
      badge.appendChild(label);

      const menu = buildMenu();
      appendSaveButtons(menu);

      badge.addEventListener("click", (event) => {
        event.stopPropagation();
        menu.classList.toggle("hidden");
      });

      container.appendChild(badge);
      container.appendChild(menu);
      return;
    }

    const badge = document.createElement("div");
    badge.className = "user-badge-main";

    const avatar = document.createElement("span");
    avatar.className = "user-avatar";
    avatar.textContent = (currentUser.email || "U").charAt(0).toUpperCase();

    const label = document.createElement("span");
    label.className = "user-label";
    label.textContent = (currentUser.email || "").split("@")[0] || "用户";

    const sync = document.createElement("span");
    sync.className = "sync-indicator";
    const state = CloudSync.getSyncState();
    if (state === "syncing") {
      sync.classList.add("sync-spinner");
    } else if (state === "success") {
      sync.classList.add("sync-ok");
      sync.textContent = "✓";
    } else if (state === "error") {
      sync.classList.add("sync-error");
      sync.textContent = "!";
    } else {
      sync.classList.add("sync-idle");
      sync.textContent = "○";
    }

    badge.appendChild(avatar);
    badge.appendChild(label);
    badge.appendChild(sync);

    const menu = buildMenu();

    const account = document.createElement("div");
    account.className = "user-menu-item user-menu-account";
    account.textContent = currentUser.email;
    menu.appendChild(account);

    const syncTime = document.createElement("div");
    syncTime.className = "user-menu-item user-menu-meta";
    syncTime.textContent = syncLabel();
    menu.appendChild(syncTime);

    const syncBtn = document.createElement("button");
    syncBtn.type = "button";
    syncBtn.className = "user-menu-item";
    syncBtn.textContent = "手动同步存档";
    syncBtn.addEventListener("click", async () => {
      menu.classList.add("hidden");
      await CloudSync.sync(true);
      render();
    });
    menu.appendChild(syncBtn);

    appendSaveButtons(menu);

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "user-menu-item user-menu-danger";
    logoutBtn.textContent = "退出登录";
    logoutBtn.addEventListener("click", async () => {
      menu.classList.add("hidden");
      await SupabaseAuth.signOut();
      AuthPanel.open();
    });
    menu.appendChild(logoutBtn);

    badge.addEventListener("click", (event) => {
      event.stopPropagation();
      menu.classList.toggle("hidden");
    });

    container.appendChild(badge);
    container.appendChild(menu);
  }

  function init() {
    if (inited) return;
    inited = true;
    document.addEventListener("click", () => {
      const menu = document.querySelector(".user-menu");
      if (menu) menu.classList.add("hidden");
    });
    SupabaseAuth.onAuthChange(() => render());
    CloudSync.onSyncChange(() => render());
    render();
  }

  return {
    init,
    render
  };
})();
