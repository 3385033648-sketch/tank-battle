(function () {
  RewardCodeSystem.reconcile();
  RewardPanel.init();
  UserBadge.init();
  CloudSync.init();
  SupabaseAuth.init().then(() => {
    UserBadge.render();
  });

  const canvas = document.getElementById("game");
  const game = new Game(canvas);
  window.__steelFront = game;

  const params = new URLSearchParams(location.search);
  const autoplay = params.get("autoplay");
  if (autoplay) {
    setTimeout(() => {
      game.startMode(autoplay);
    }, 120);
  }
  const openPanel = params.get("panel");
  if (openPanel) {
    setTimeout(() => {
      const btn = document.getElementById(openPanel + "Btn");
      if (btn) btn.click();
    }, 320);
  }
})();
