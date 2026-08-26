/**
 * Account status badge shown in the top-right corner.
 * Offline-only build: always renders the local save badge with
 * import/export actions (no sign-up / sign-in entry points).
 */
const UserBadge = (() => {
  let inited = false;

  function el(id) {
    return document.getElementById(id);
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
  }

  function init() {
    if (inited) return;
    inited = true;
    document.addEventListener("click", () => {
      const menu = document.querySelector(".user-menu");
      if (menu) menu.classList.add("hidden");
    });
    SupabaseAuth.onAuthChange(() => render());
    render();
  }

  return {
    init,
    render
  };
})();
