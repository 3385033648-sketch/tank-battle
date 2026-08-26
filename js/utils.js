/**
 * 通用工具：数学、碰撞、时间与绘制辅助。
 */
const Utils = (() => {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function dist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.hypot(dx, dy);
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInt(min, max) {
    return Math.floor(randomBetween(min, max + 1));
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function rectsCollide(a, b, margin) {
    const m = margin || 0;
    return (
      a.x + m < b.x + b.w - m &&
      a.x + a.w - m > b.x + m &&
      a.y + m < b.y + b.h - m &&
      a.y + a.h - m > b.y + m
    );
  }

  function pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function normalizeAngle(angle) {
    while (angle <= -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
  }

  function angleDiff(a, b) {
    return normalizeAngle(b - a);
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return m + ":" + String(rest).padStart(2, "0");
  }

  /**
   * 确定性随机：同一 seed 生成同一地图，关卡可复现。
   */
  function seededRandom(seed) {
    let value = seed >>> 0;
    return function () {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function secondsToPillars(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    return {
      seconds: total,
      text: formatTime(total)
    };
  }

  return {
    clamp,
    lerp,
    dist,
    randomBetween,
    randomInt,
    rectsOverlap,
    rectsCollide,
    pointInRect,
    normalizeAngle,
    angleDiff,
    formatTime,
    seededRandom,
    pick,
    shuffle,
    roundRect,
    secondsToPillars
  };
})();
