/**
 * 实体：坦克、子弹、道具。渲染全部基于 Canvas 矢量绘制。
 */
class Tank {
  constructor(opts) {
    const size = opts.size || 26;
    this.id = Utils.randomInt(1, 999999);
    this.x = opts.x;
    this.y = opts.y;
    this.w = size;
    this.h = size;
    this.direction = opts.direction || { x: 0, y: -1 };
    this.speed = opts.speed || 90;
    this.hp = opts.hp || 1;
    this.maxHp = opts.hp || 1;
    this.team = opts.team || "red";
    this.isPlayer = !!opts.isPlayer;
    this.role = opts.role || "normal";
    this.profile = opts.profile || null;
    this.profileKey = opts.profileKey || null;
    this.skinConfig = opts.skinConfig || null;
    this.color = opts.color || "#9aa3ad";
    this.accent = opts.accent || "#cdd4db";
    this.score = opts.score || 0;
    this.fireInterval = opts.fireInterval || 1.5;
    this.bulletSpeed = opts.bulletSpeed || 280;
    this.spread = opts.spread || 1;
    this.bulletDamage = opts.bulletDamage || 1;
    this.firepower = opts.firepower || 1;
    this.fireTimer = Utils.randomBetween(0.4, 1.4);
    this.alive = true;
    this.invincibleTimer = opts.invincibleTimer || 0;
    this.freezeTimer = 0;
    this.knockX = 0;
    this.knockY = 0;
    this.knockTimer = 0;
    this.thinkTimer = Utils.randomBetween(0.5, 1.4);
    this.think = 0;
    this.postShotTimer = 0;
    this.respawnTimer = 0;
    this.trailTimer = 0;
    this.ghostTimer = 0;
    this.burnTimer = 0;
    this.burnTick = 1;
    this.spawnTimer = 0.6;
    this.stuckFrames = 0;
    this.facingAngle = Math.atan2(this.direction.y, this.direction.x);
    this.turretAngle = this.facingAngle;
  }

  center() {
    return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
  }

  rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  setDirection(direction) {
    if (direction.x === 0 && direction.y === 0) return;
    this.direction = { x: direction.x, y: direction.y };
    this.facingAngle = Math.atan2(direction.y, direction.x);
  }

  canPlace(x, y, map, others) {
    if (
      x < 0 ||
      y < 0 ||
      x + this.w > GameConfig.LOGICAL_WIDTH ||
      y + this.h > GameConfig.LOGICAL_HEIGHT
    ) {
      return false;
    }
    if (map && map.blocked({ x, y, w: this.w, h: this.h }, false)) return false;
    if (others) {
      const rect = { x, y, w: this.w, h: this.h };
      for (let i = 0; i < others.length; i++) {
        const other = others[i];
        if (other === this || !other.alive) continue;
        if (Utils.rectsOverlap(rect, other.rect())) return false;
      }
    }
    return true;
  }

  resolveCollision(map, others) {
    if (this.canPlace(this.x, this.y, map, others)) return false;
    const step = 2;
    const maxRadius = 96;
    for (let radius = step; radius <= maxRadius; radius += step) {
      for (let dy = -radius; dy <= radius; dy += step) {
        for (let dx = -radius; dx <= radius; dx += step) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = this.x + dx;
          const y = this.y + dy;
          if (this.canPlace(x, y, map, others)) {
            this.x = x;
            this.y = y;
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 分轴移动：先 x 后 y，撞到墙体或坦克时在该轴停下，可沿墙滑动。
   */
  move(dx, dy, map, others) {
    const beforeX = this.x;
    const beforeY = this.y;
    const step = (axis, amount) => {
      if (amount === 0) return;
      const nextX = axis === "x" ? this.x + amount : this.x;
      const nextY = axis === "y" ? this.y + amount : this.y;
      const rect = { x: nextX, y: nextY, w: this.w, h: this.h };
      if (map.blocked(rect, false)) return;
      for (let i = 0; i < others.length; i++) {
        const other = others[i];
        if (other === this || !other.alive) continue;
        if (Utils.rectsCollide(rect, other.rect(), 1.5)) return;
      }
      if (axis === "x") this.x = Utils.clamp(nextX, 0, GameConfig.LOGICAL_WIDTH - this.w);
      else this.y = Utils.clamp(nextY, 0, GameConfig.LOGICAL_HEIGHT - this.h);
    };
    step("x", dx);
    step("y", dy);
    this.resolveCollision(map, others);
    if (dx !== 0 || dy !== 0) {
      const moved = Math.abs(this.x - beforeX) > 0.01 || Math.abs(this.y - beforeY) > 0.01;
      if (moved) {
        this.stuckFrames = 0;
      } else {
        this.stuckFrames++;
        if (this.stuckFrames >= 15) {
          this.resolveCollision(map, others);
          this.stuckFrames = 0;
        }
      }
    }
  }

  takeKnockback(direction, power) {
    this.knockX = direction.x * power;
    this.knockY = direction.y * power;
    this.knockTimer = 0.18;
  }

  updateTimers(dt) {
    this.fireTimer = Math.max(0, this.fireTimer - dt);
    this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    this.ghostTimer = Math.max(0, this.ghostTimer - dt);
    this.burnTimer = Math.max(0, this.burnTimer - dt);
    this.spawnTimer = Math.max(0, this.spawnTimer - dt);
    if (this.knockTimer > 0) {
      this.knockTimer -= dt;
      if (this.knockTimer <= 0) {
        this.knockX = 0;
        this.knockY = 0;
      }
    }
  }

  draw(ctx, time) {
    if (!this.alive) return;
    const blink = this.spawnTimer > 0 && Math.floor(time * 14) % 2 === 0;
    const ghost = this.ghostTimer > 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.45 : ghost ? 0.22 : 1;
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    ctx.rotate(this.facingAngle);

    if (this.skinConfig && this.skinConfig.visuals && this.skinConfig.visuals.aura) {
      ctx.shadowColor = this.skinConfig.visuals.auraColor || this.accent;
      ctx.shadowBlur = 18 + Math.sin(time * 7) * 6;
    }

    const half = this.w / 2;
    ctx.fillStyle = "#222c3a";
    ctx.fillRect(-half, -half - 3, this.w, 6);
    ctx.fillRect(-half, half - 3, this.w, 6);
    ctx.fillStyle = "#151b25";
    for (let i = 0; i < 5; i++) {
      const tx = -half + 3 + i * 6;
      ctx.fillRect(tx, -half - 3, 2.5, 6);
      ctx.fillRect(tx, half - 3, 2.5, 6);
    }

    const bodyColor = this.getBodyColor();
    ctx.fillStyle = bodyColor;
    Utils.roundRect(ctx, -half + 3, -half + 3, this.w - 6, this.h - 6, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = this.isPlayer ? "#cfe6ff" : "#11161d";
    ctx.fillRect(half - 4, -3, 20, 6);
    ctx.fillStyle = this.isPlayer ? "#2c5c99" : "#1b232d";
    ctx.fillRect(half + 8, -5, 9, 10);

    ctx.fillStyle = this.isPlayer ? "#0f2b4d" : "#26313d";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.accent;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    if (this.skinConfig && this.skinConfig.visuals && this.skinConfig.visuals.shimmer) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(time * 9) * 0.3;
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-half + 4, -half + 5 + Math.sin(time * 5) * 4);
      ctx.lineTo(half - 4, -half + 5 + Math.sin(time * 5 + 1) * 4);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    if (this.burnTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#ff7a3c";
      ctx.fillRect(this.x, this.y + this.h - 4, this.w * (this.burnTimer / 3), 3);
      ctx.restore();
    }

    if (this.invincibleTimer > 0) {
      const pulse = 0.6 + Math.sin(time * 10) * 0.4;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "#8fd0ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w * 0.78, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.freezeTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#bfe9ff";
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.restore();
    }

    if (this.hp < this.maxHp && this.maxHp > 1) {
      const ratio = this.hp / this.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(this.x, this.y - 7, this.w, 4);
      ctx.fillStyle = ratio > 0.5 ? "#42d392" : ratio > 0.25 ? "#ffcf4d" : "#ff5d5d";
      ctx.fillRect(this.x, this.y - 7, this.w * ratio, 4);
    }
  }

  getBodyColor() {
    if (this.role === "armored") {
      if (this.hp >= 4) return "#e0b12c";
      if (this.hp === 3) return "#e07b2c";
      if (this.hp === 2) return "#d94f4f";
      return "#8d3434";
    }
    return this.color;
  }
}

class Bullet {
  constructor(opts) {
    this.x = opts.x;
    this.y = opts.y;
    this.w = opts.w || 8;
    this.h = opts.h || 8;
    this.direction = opts.direction;
    this.speed = opts.speed;
    this.owner = opts.owner || null;
    this.team = opts.team || "red";
    this.damage = opts.damage || 1;
    this.color = opts.color || "#ffd166";
    this.life = opts.life || 1.8;
    this.trailTimer = 0;
    this.alive = true;
    this.isPlayerBullet = opts.isPlayerBullet || false;
  }

  rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  center() {
    return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
  }

  update(dt) {
    this.life -= dt;
    this.x += this.direction.x * this.speed * dt;
    this.y += this.direction.y * this.speed * dt;
    this.trailTimer -= dt;
    return this.life <= 0 ||
      this.x < -20 ||
      this.x > GameConfig.LOGICAL_WIDTH + 20 ||
      this.y < -20 ||
      this.y > GameConfig.LOGICAL_HEIGHT + 20;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = this.color;
    Utils.roundRect(ctx, this.x, this.y, this.w, this.h, 2);
    ctx.fill();
    ctx.fillStyle = "#fff6d8";
    ctx.fillRect(this.x + 2, this.y + 2, Math.max(2, this.w - 4), Math.max(2, this.h - 4));
    ctx.restore();
  }
}

class Powerup {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.size = 26;
    this.life = 12;
    this.phase = Math.random() * Math.PI * 2;
    this.alive = true;
  }

  rect() {
    const inset = 5;
    return { x: this.x - this.size / 2, y: this.y - this.size / 2, w: this.size, h: this.size };
  }

  update(dt) {
    this.life -= dt;
    this.phase += dt * 3;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx, time) {
    const bob = Math.sin(this.phase) * 3;
    const x = this.x;
    const y = this.y + bob;
    const blink = this.life < 3 && Math.floor(time * 8) % 2 === 0;
    if (blink) return;
    const color = GameConfig.POWERUPS[this.type].color;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(8,14,24,0.65)";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    this.drawIcon(ctx);
    ctx.restore();
  }

  drawIcon(ctx) {
    if (this.type === "star") {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? 10 : 4.5;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (this.type === "tank") {
      Utils.roundRect(ctx, -6, -4, 12, 9, 2);
      ctx.fill();
      ctx.fillRect(4, -1.5, 7, 3);
      ctx.beginPath();
      ctx.arc(-1, 0, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = "#10151d";
      ctx.fill();
    } else if (this.type === "helmet") {
      ctx.beginPath();
      ctx.arc(0, 2, 9, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-9, 2, 18, 3);
      ctx.beginPath();
      ctx.arc(-5, 3, 2.5, 0, Math.PI * 2);
      ctx.arc(5, 3, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#10151d";
      ctx.fill();
    } else if (this.type === "bomb") {
      ctx.beginPath();
      ctx.arc(0, 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-1, -7, 2, 4);
      ctx.fillStyle = "#ffcf4d";
      ctx.beginPath();
      ctx.arc(0, -7, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === "shovel") {
      ctx.fillRect(-8, -2, 16, 4);
      ctx.fillRect(-2, -8, 4, 16);
    } else if (this.type === "clock") {
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#10151d";
      ctx.fill();
      ctx.strokeStyle = GameConfig.POWERUPS.clock.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -5);
      ctx.moveTo(0, 0);
      ctx.lineTo(4, 2);
      ctx.stroke();
    }
  }
}
