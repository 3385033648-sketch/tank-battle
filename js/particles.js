/**
 * 轻量粒子系统：火花、履带痕、炮口焰、烟雾、砖块碎片与飘字。
 */
const ParticleSystem = (() => {
  const particles = [];
  let quality = 1;

  function setQuality(value) {
    quality = value ? 1 : 0.35;
  }

  function push(p) {
    if (particles.length > 900) particles.splice(0, particles.length - 900);
    particles.push(p);
  }

  function spawnExplosion(x, y, scale) {
    const s = (scale || 1) * quality;
    const count = Math.round(22 * s);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Utils.randomBetween(40, 220) * s;
      push({
        type: "spark",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 24,
        life: Utils.randomBetween(0.3, 0.85),
        maxLife: 0.85,
        size: Utils.randomBetween(2, 5),
        color: Utils.pick(["#ffdf6b", "#ff9f43", "#ff5d5d", "#fff3c4"])
      });
    }
    for (let i = 0; i < Math.round(8 * s); i++) {
      push({
        type: "smoke",
        x: x + Utils.randomBetween(-8, 8),
        y: y + Utils.randomBetween(-8, 8),
        vx: Utils.randomBetween(-14, 14),
        vy: Utils.randomBetween(-40, -16),
        life: Utils.randomBetween(0.7, 1.5),
        maxLife: 1.5,
        size: Utils.randomBetween(8, 18) * s,
        color: "#3a4452"
      });
    }
    push({
      type: "shock",
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.32,
      maxLife: 0.32,
      size: 10 * s,
      color: "#fff6d8"
    });
  }

  function spawnMuzzle(x, y, direction, color) {
    const count = Math.max(1, Math.round(6 * quality));
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.7;
      const angle = Math.atan2(direction.y, direction.x) + spread;
      const speed = Utils.randomBetween(120, 260);
      push({
        type: "spark",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.16,
        maxLife: 0.16,
        size: Utils.randomBetween(2, 4),
        color: color || "#ffd166"
      });
    }
  }

  function spawnStarTrail(x, y, color) {
    push({
      type: "spark",
      x,
      y,
      vx: Utils.randomBetween(-12, 12),
      vy: Utils.randomBetween(-12, 12),
      life: Utils.randomBetween(0.35, 0.7),
      maxLife: 0.7,
      size: Utils.randomBetween(1.5, 3),
      color: color || "#b48bff"
    });
  }

  function spawnTracks(x, y, direction) {
    if (Math.random() > 0.5 * quality) return;
    const side = direction.x === 0 ? 1 : 0;
    const offset = direction.x !== 0 ? 5 : 6;
    push({
      type: "track",
      x: x + side * offset,
      y: y + (direction.x !== 0 ? offset : 0),
      vx: 0,
      vy: 0,
      life: 2.2,
      maxLife: 2.2,
      size: 4,
      color: "rgba(30,38,48,0.55)"
    });
  }

  function spawnSmoke(x, y, scale) {
    const s = (scale || 1) * quality;
    push({
      type: "smoke",
      x,
      y,
      vx: Utils.randomBetween(-8, 8),
      vy: Utils.randomBetween(-34, -18),
      life: Utils.randomBetween(0.8, 1.8),
      maxLife: 1.8,
      size: Utils.randomBetween(7, 16) * s,
      color: "#55606f"
    });
  }

  function spawnBrickDebris(x, y) {
    for (let i = 0; i < 6 * quality; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Utils.randomBetween(30, 150);
      push({
        type: "debris",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: Utils.randomBetween(0.4, 0.9),
        maxLife: 0.9,
        size: Utils.randomBetween(3, 7),
        color: Utils.pick(["#a35532", "#c67645", "#7f4327"])
      });
    }
  }

  function spawnText(x, y, text, color) {
    push({
      type: "text",
      x,
      y,
      vx: 0,
      vy: -34,
      life: 1.1,
      maxLife: 1.1,
      size: 16,
      color: color || "#ffffff",
      text
    });
  }

  function spawnFreeze(x, y) {
    for (let i = 0; i < 12 * quality; i++) {
      push({
        type: "snow",
        x: x + Utils.randomBetween(-10, 10),
        y: y + Utils.randomBetween(-10, 10),
        vx: Utils.randomBetween(-8, 8),
        vy: Utils.randomBetween(-18, -6),
        life: Utils.randomBetween(0.4, 0.9),
        maxLife: 0.9,
        size: Utils.randomBetween(2, 5),
        color: "#bfe9ff"
      });
    }
  }

  function spawnLegendaryKill(x, y) {
    for (let i = 0; i < Math.round(34 * quality); i++) {
      const angle = (i / 34) * Math.PI * 2 + Math.random() * 0.3;
      const speed = Utils.randomBetween(180, 520);
      push({
        type: "spark",
        x: x + Math.cos(angle) * 120,
        y: y + Math.sin(angle) * 90,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: Utils.randomBetween(0.4, 1.1),
        maxLife: 1.1,
        size: Utils.randomBetween(2, 6),
        color: Utils.pick(["#ffd166", "#ff7a3c", "#b48bff", "#ffffff"])
      });
    }
    push({
      type: "shock",
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.5,
      maxLife: 0.5,
      size: 20,
      color: "#fff2b0"
    });
    for (let i = 0; i < 14 * quality; i++) {
      push({
        type: "smoke",
        x: x + Utils.randomBetween(-140, 140),
        y: y + Utils.randomBetween(-110, 110),
        vx: Utils.randomBetween(-30, 30),
        vy: Utils.randomBetween(-60, -20),
        life: Utils.randomBetween(0.7, 1.6),
        maxLife: 1.6,
        size: Utils.randomBetween(8, 20),
        color: Utils.pick(["#3a4452", "#8a2f2f", "#4d3f9e"])
      });
    }
  }

  function spawnBurn(x, y) {
    for (let i = 0; i < 8 * quality; i++) {
      push({
        type: "spark",
        x: x + Utils.randomBetween(-6, 6),
        y: y + Utils.randomBetween(-6, 6),
        vx: Utils.randomBetween(-30, 30),
        vy: Utils.randomBetween(-60, -20),
        life: Utils.randomBetween(0.25, 0.55),
        maxLife: 0.55,
        size: Utils.randomBetween(2, 4),
        color: Utils.pick(["#ff7a3c", "#ffd166", "#ff5533"])
      });
    }
  }

  function clear() {
    particles.length = 0;
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      if (p.type === "spark") {
        p.vy += 240 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.type === "smoke") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += 8 * dt;
      } else if (p.type === "debris") {
        p.vy += 420 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.type === "snow") {
        p.x += p.vx * dt + Math.sin(p.life * 5) * 12 * dt;
        p.y += p.vy * dt;
      } else if (p.type === "text" || p.type === "shock") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
  }

  function draw(ctx) {
    particles.forEach((p) => {
      const alpha = Utils.clamp(p.life / p.maxLife, 0, 1);
      if (p.type === "spark") {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.type === "smoke") {
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "track") {
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 1.5);
      } else if (p.type === "debris") {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 9);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else if (p.type === "snow") {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "shock") {
        const r = p.size + (1 - alpha) * 52;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === "text") {
        ctx.globalAlpha = alpha;
        ctx.font = "bold 15px 'Segoe UI', 'Microsoft YaHei', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      }
    });
    ctx.globalAlpha = 1;
  }

  return {
    setQuality,
    spawnExplosion,
    spawnMuzzle,
    spawnTracks,
    spawnSmoke,
    spawnBrickDebris,
    spawnText,
    spawnFreeze,
    spawnLegendaryKill,
    spawnBurn,
    spawnStarTrail,
    clear,
    update,
    draw
  };
})();
