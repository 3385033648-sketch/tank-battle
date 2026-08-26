/**
 * 游戏主控制器：状态机、主循环、碰撞、道具、结算与 UI 绑定。
 */
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.settings = SaveManager.getSettings();
    this.state = "menu";
    this.mode = null;
    this.modeName = null;
    this.map = null;
    this.tanks = [];
    this.bullets = [];
    this.powerups = [];
    this.score = 0;
    this.kills = 0;
    this.player = null;
    this.playerLives = 0;
    this.playerHp = 0;
    this.playerMaxHp = 0;
    this.respawnTimer = 0;
    this.freezeTimer = 0;
    this.shake = 0;
    this.time = 0;
    this.ended = false;
    this.lastMode = "classic";
    this.coinsEarned = 0;
    this.powerupsUsed = 0;
    this.particles = ParticleSystem;
    this.hudTimer = 0;
    this.tankPruneTimer = 1;
    this.renderScale = 1;
    this.lastScaleChange = 0;
    this.frameCosts = [];

    this.bindUI();
    MetaUI.bind(this);
    this.applySettings();
    InputManager.bind();
    InputManager.setCallbacks({
      pause: () => this.togglePause(),
      quit: () => this.quitToMenu(),
      any: () => AudioFX.resume()
    });
    const joystick = document.getElementById("joystick");
    const knob = document.getElementById("joystickKnob");
    const fireBtn = document.getElementById("fireBtn");
    InputManager.bindTouch(joystick, knob, fireBtn);
    this.detectTouch();
    this.updateMenuRecords();

    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const frameStart = performance.now();
      this.update(dt);
      this.draw(now / 1000);
      this.trackFrame(performance.now() - frameStart);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  applyRenderScale() {
    this.renderScale = Math.max(0.55, Math.min(1, this.renderScale));
    this.canvas.width = Math.max(1, Math.round(GameConfig.LOGICAL_WIDTH * this.renderScale));
    this.canvas.height = Math.max(1, Math.round(GameConfig.LOGICAL_HEIGHT * this.renderScale));
    window.__tankLowPerf = this.renderScale < 0.85;
    if (this.settings.particles) {
      ParticleSystem.setQuality(this.renderScale >= 0.85);
    }
  }

  trackFrame(cost) {
    this.frameCosts.push(cost);
    if (this.frameCosts.length > 90) this.frameCosts.shift();
    if (this.state !== "playing" || this.time < 2.5) return;
    const avg = this.frameCosts.reduce((sum, value) => sum + value, 0) / this.frameCosts.length;
    if (avg > 22 && this.renderScale > 0.55) {
      this.renderScale = Math.max(0.55, this.renderScale - 0.15);
      this.applyRenderScale();
      this.lastScaleChange = this.time;
    } else if (
      avg < 13 &&
      this.renderScale < 1 &&
      this.time - this.lastScaleChange > 8
    ) {
      this.renderScale = Math.min(1, this.renderScale + 0.15);
      this.applyRenderScale();
      this.lastScaleChange = this.time;
    }
  }

  bindUI() {
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.startMode(btn.dataset.mode));
    });
    document.getElementById("settingsBtn").addEventListener("click", () => {
      document.getElementById("settingsPanel").classList.remove("hidden");
    });
    document.getElementById("settingsClose").addEventListener("click", () => {
      document.getElementById("settingsPanel").classList.add("hidden");
    });
    ["sound", "music", "shake", "particles", "contrast"].forEach((key) => {
      const input = document.getElementById("set" + key.charAt(0).toUpperCase() + key.slice(1));
      input.checked = !!this.settings[key];
      input.addEventListener("change", () => {
        SaveManager.updateSettings({ [key]: input.checked });
        this.settings = SaveManager.getSettings();
        this.applySettings();
      });
    });
    document.getElementById("retryBtn").addEventListener("click", () => {
      document.getElementById("result").classList.add("hidden");
      this.startMode(this.lastMode);
    });
    document.getElementById("menuBtn").addEventListener("click", () => {
      this.quitToMenu();
    });
    document.getElementById("pauseBtn").addEventListener("click", () => this.togglePause());
    document.getElementById("pauseTouchBtn").addEventListener("click", () => this.togglePause());
    document.getElementById("resumeBtn").addEventListener("click", () => this.togglePause());
    document.getElementById("quitBtn").addEventListener("click", () => this.quitToMenu());
  }

  applySettings() {
    AudioFX.setSound(this.settings.sound);
    AudioFX.setMusic(this.settings.music);
    ParticleSystem.setQuality(this.settings.particles);
    document.body.classList.toggle("contrast", !!this.settings.contrast);
  }

  detectTouch() {
    const touch = document.getElementById("touch");
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (coarse || "ontouchstart" in window) {
      touch.classList.add("touch-enabled");
      touch.classList.remove("hidden");
      InputManager.setTouchMode(true);
    }
  }

  startMode(name) {
    AudioFX.resume();
    AudioFX.startMusic(name);
    this.lastMode = name;
    this.modeName = name;
    this.score = 0;
    this.kills = 0;
    this.coinsEarned = 0;
    this.powerupsUsed = 0;
    this.ended = false;
    this.freezeTimer = 0;
    this.respawnTimer = 0;
    this.tanks = [];
    this.bullets = [];
    this.powerups = [];
    ParticleSystem.clear();

    if (name === "classic") this.mode = new ClassicMode(this);
    else if (name === "survival") this.mode = new SurvivalMode(this);
    else this.mode = new BrawlMode(this);
    this.mode.init();

    this.state = "playing";
    document.getElementById("menu").classList.add("hidden");
    document.getElementById("result").classList.add("hidden");
    document.getElementById("hud").classList.remove("hidden");
  }

  update(dt) {
    if (this.state !== "playing") return;
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 26);
    this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    if (this.mode) this.mode.update(dt);
    if (this.map) this.map.update(dt);

    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawnPlayer();
    }

    this.updatePlayer(dt);
    this.updateAITanks(dt);
    this.tanks.forEach((tank) => tank.updateTimers(dt));
    this.updateKnockback(dt);
    this.updateBurn(dt);
    this.updateBullets(dt);
    this.updatePowerups(dt);
    ParticleSystem.update(dt);
    this.tankPruneTimer -= dt;
    if (this.tankPruneTimer <= 0) {
      this.pruneDeadTanks();
      this.tankPruneTimer = 1;
    }
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.updateHud();
      this.hudTimer = 0.1;
    }
  }

  updatePlayer(dt) {
    const player = this.player;
    if (!player || !player.alive || player.freezeTimer > 0) return;
    const move = InputManager.getMove();
    const length = Math.hypot(move.x, move.y);
    if (length > 0.01) {
      const direction =
        Math.abs(move.x) > Math.abs(move.y)
          ? { x: Math.sign(move.x), y: 0 }
          : { x: 0, y: Math.sign(move.y) };
      player.setDirection(direction);
      player.move(direction.x * player.speed * dt, direction.y * player.speed * dt, this.map, this.tanks);
      player.trailTimer -= dt;
      if (player.trailTimer <= 0) {
        const center = player.center();
        ParticleSystem.spawnTracks(
          center.x - direction.x * player.w * 0.45,
          center.y - direction.y * player.h * 0.45,
          direction
        );
        player.trailTimer = 0.12;
        if (player.skinConfig && player.skinConfig.visuals && player.skinConfig.visuals.trail) {
          ParticleSystem.spawnStarTrail(
            center.x - direction.x * 10 + Utils.randomBetween(-3, 3),
            center.y - direction.y * 10 + Utils.randomBetween(-3, 3),
            player.skinConfig.visuals.trailColor
          );
        }
      }
    }
    if (InputManager.getShootHeld()) this.fireTank(player);
  }

  updateAITanks(dt) {
    this.tanks.forEach((tank) => {
      if (!tank.isPlayer && tank.alive) {
        TankAI.update(tank, this, dt);
      }
    });
  }

  updateKnockback(dt) {
    this.tanks.forEach((tank) => {
      if (tank.knockTimer > 0) {
        tank.move(tank.knockX * dt, tank.knockY * dt, this.map, this.tanks);
      }
    });
  }

  updateBurn(dt) {
    this.tanks.forEach((tank) => {
      if (!tank.alive || tank.team === "blue" || tank.burnTimer <= 0) return;
      tank.burnTick -= dt;
      ParticleSystem.spawnBurn(tank.center().x, tank.center().y);
      if (tank.burnTick <= 0) {
        tank.burnTick = 1;
        tank.hp -= 1;
        if (tank.hp <= 0) {
          this.killTank(tank, this.player);
        }
      }
    });
  }

  fireTank(tank) {
    if (!tank.alive || tank.fireTimer > 0 || tank.freezeTimer > 0 || tank.spawnTimer > 0) return;
    const center = tank.center();
    const firepower = tank.isPlayer ? tank.firepower : tank.spread || 1;
    const angles = [];
    if (firepower === 1) {
      angles.push(0);
    } else if (firepower === 2) {
      angles.push(-0.08, 0.08);
    } else {
      angles.push(-0.16, 0, 0.16);
    }
    angles.forEach((offset, index) => {
      const angle = tank.facingAngle + offset;
      const dir = { x: Math.cos(angle), y: Math.sin(angle) };
      const perp = { x: -dir.y, y: dir.x };
      const sideOffset = firepower === 2 ? (index === 0 ? -6 : 6) : 0;
      const startX = center.x + dir.x * (tank.w / 2 + 8) + perp.x * sideOffset;
      const startY = center.y + dir.y * (tank.h / 2 + 8) + perp.y * sideOffset;
      const bullet = new Bullet({
        x: startX - 4,
        y: startY - 4,
        direction: dir,
        speed: tank.bulletSpeed,
        owner: tank,
        team: tank.team,
        damage: tank.bulletDamage,
        color:
          tank.isPlayer && tank.skinConfig && tank.skinConfig.visuals && tank.skinConfig.visuals.muzzleColor
            ? tank.skinConfig.visuals.muzzleColor
            : tank.isPlayer
              ? "#ffd166"
              : "#ff7f6b",
        burn: !!(tank.isPlayer && tank.skinConfig && tank.skinConfig.visuals && tank.skinConfig.visuals.burn),
        isPlayerBullet: tank.isPlayer
      });
      this.bullets.push(bullet);
    });
    tank.fireTimer = tank.fireInterval;
    const muzzleColor =
      tank.isPlayer && tank.skinConfig && tank.skinConfig.visuals && tank.skinConfig.visuals.muzzleColor
        ? tank.skinConfig.visuals.muzzleColor
        : null;
    ParticleSystem.spawnMuzzle(center.x + tank.direction.x * (tank.w / 2 + 4), center.y + tank.direction.y * (tank.h / 2 + 4), tank.direction, muzzleColor);
    AudioFX.shot(tank.isPlayer);
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      const dead = bullet.update(dt);
      if (dead) {
        this.bullets.splice(i, 1);
        continue;
      }

      const center = bullet.center();
      const tileType = this.map.tileAtPixel(center.x, center.y);
      if (this.map.isSolidTile(tileType, true)) {
        if (tileType === TILE.BRICK) {
          this.map.destroyBrickAtPixel(center.x, center.y);
          ParticleSystem.spawnBrickDebris(center.x, center.y);
          AudioFX.hit();
        } else if (tileType === TILE.STEEL) {
          ParticleSystem.spawnMuzzle(center.x, center.y, bullet.direction);
          AudioFX.hit();
        } else if (tileType === TILE.BASE) {
          this.map.destroyBase();
          ParticleSystem.spawnExplosion(center.x, center.y, 1.4);
          AudioFX.explosion(1.6);
          this.endGame(false, "基地被摧毁");
        }
        this.bullets.splice(i, 1);
        continue;
      }

      let hitTank = false;
      for (let t = 0; t < this.tanks.length; t++) {
        const tank = this.tanks[t];
        if (!tank.alive || tank.team === bullet.team) continue;
        if (Utils.rectsOverlap(bullet.rect(), tank.rect())) {
          this.damageTank(tank, bullet.damage, bullet.owner, bullet);
          this.bullets.splice(i, 1);
          hitTank = true;
          break;
        }
      }
      if (hitTank) continue;

      for (let b = 0; b < this.bullets.length; b++) {
        const other = this.bullets[b];
        if (b === i || !other.alive || other.team === bullet.team) continue;
        if (Utils.rectsOverlap(bullet.rect(), other.rect())) {
          ParticleSystem.spawnMuzzle(center.x, center.y, { x: 0, y: 0 });
          this.bullets.splice(i, 1);
          if (b > i) b--;
          this.bullets.splice(b, 1);
          i = Math.max(-1, i - 1);
          break;
        }
      }
    }
  }

  damageTank(target, damage, source, bullet) {
    if (!target.alive || target.invincibleTimer > 0) return false;
    target.hp -= damage;
    if (bullet && bullet.burn && !target.isPlayer) {
      target.burnTimer = 3;
      target.burnTick = 1;
    }
    if (target.isPlayer && this.modeName === "survival") {
      this.playerHp = Math.max(0, target.hp);
    }
    AudioFX.hit();
    ParticleSystem.spawnSmoke(target.center().x, target.center().y, 0.7);
    if (bullet && bullet.direction) {
      target.takeKnockback(bullet.direction, 4);
    }
    if (target.hp <= 0) {
      this.killTank(target, source);
      return true;
    }
    if (target.isPlayer && target.skinConfig && target.skinConfig.visuals && target.skinConfig.visuals.ghost) {
      target.ghostTimer = 2;
    }
    if (target.isPlayer) {
      target.invincibleTimer = Math.max(target.invincibleTimer, 1.2);
      this.shake = Math.max(this.shake, 5);
    }
    return false;
  }

  killTank(target, source) {
    if (!target.alive) return;
    target.alive = false;
    const center = target.center();
    const explosionScale = target.isPlayer ? 1.8 : 0.7 + Math.min(1.5, target.maxHp * 0.08);
    ParticleSystem.spawnExplosion(center.x, center.y, explosionScale);
    this.shake = Math.max(this.shake, 3 + Math.min(8, target.maxHp));

    if (target.isPlayer) {
      AudioFX.explosion(1.7);
      if (this.mode) this.mode.onPlayerKilled();
      return;
    }

    this.kills++;
    SaveManager.addKills(1, { [target.role || "unknown"]: 1 });
    EconomyStore.recordTaskProgress("kill20", 1);
    if (this.modeName === "brawl") EconomyStore.recordTaskProgress("brawl_kills5", 1);
    this.coinsEarned += this.getCoinReward(target);
    if (this.mode && this.mode.name === "brawl") {
      this.mode.onEnemyKilled(target);
    } else {
      this.addScore(target.score, center.x, center.y - 12, "+" + target.score);
      this.mode.onEnemyKilled(target);
    }
    AudioFX.explosion(0.7 + Math.min(1.4, target.maxHp * 0.08));
    if (source && source.isPlayer && source.skinConfig && source.skinConfig.rarity === "legendary") {
      ParticleSystem.spawnLegendaryKill(center.x, center.y);
      this.shake = Math.max(this.shake, 10);
    }
    if (this.mode && this.mode.name !== "brawl" && Math.random() < 0.22 && this.powerups.length < 4) {
      this.spawnPowerup(center.x, center.y);
    }
  }

  getCoinReward(target) {
    const base =
      target.role === "heavy" ? ECONOMY_CONFIG.rewards.heavyKill :
      target.role === "brawler" ? ECONOMY_CONFIG.rewards.brawlerKill :
      ECONOMY_CONFIG.rewards.kill;
    const skin = EconomyStore.getActiveSkin();
    return Math.round(base * (skin.bonuses.coinRate || 1));
  }

  spawnPowerup(x, y) {
    const types = ["star", "tank", "helmet", "bomb", "shovel", "clock"];
    const type = Utils.pick(types);
    this.powerups.push(new Powerup(type, Utils.clamp(x, 24, GameConfig.LOGICAL_WIDTH - 24), Utils.clamp(y, 40, GameConfig.LOGICAL_HEIGHT - 24)));
  }

  updatePowerups(dt) {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const powerup = this.powerups[i];
      powerup.update(dt);
      if (!powerup.alive) {
        this.powerups.splice(i, 1);
        continue;
      }
      if (this.player && this.player.alive && Utils.rectsOverlap(powerup.rect(), this.player.rect())) {
        this.applyPowerup(powerup.type);
        this.powerups.splice(i, 1);
      }
    }
  }

  applyPowerup(type) {
    const player = this.player;
    const label = GameConfig.POWERUPS[type].label;
    const color = GameConfig.POWERUPS[type].color;
    if (!player) return;
    this.powerupsUsed++;
    EconomyStore.recordTaskProgress("powerup10", 1);
    const durationMult = player.skinConfig && player.skinConfig.bonuses.powerupDuration ? 1 + player.skinConfig.bonuses.powerupDuration : 1;
    if (type === "star") {
      player.firepower = Math.min(GameConfig.PLAYER.maxFirepower, player.firepower + 1);
      AudioFX.powerup();
      ParticleSystem.spawnText(player.center().x, player.y - 8, label, color);
    } else if (type === "tank") {
      if (this.modeName === "survival") {
        this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 1);
        if (player.hp < this.playerMaxHp) {
          player.hp = this.playerMaxHp;
          player.maxHp = this.playerMaxHp;
        }
      } else {
        this.playerLives++;
      }
      AudioFX.life();
      ParticleSystem.spawnText(player.center().x, player.y - 8, label, color);
    } else if (type === "helmet") {
      player.invincibleTimer = 10 * durationMult;
      AudioFX.shield();
      ParticleSystem.spawnText(player.center().x, player.y - 8, "10秒" + label, color);
    } else if (type === "bomb") {
      this.destroyAllEnemies();
      AudioFX.explosion(1.8);
      ParticleSystem.spawnText(player.center().x, player.y - 8, label, color);
    } else if (type === "shovel") {
      const center = player.center();
      this.map.steelizeAround(center.x, center.y, 2);
      this.resolveTankCollisions();
      AudioFX.shovel();
      ParticleSystem.spawnText(player.center().x, player.y - 8, Math.round(20 * durationMult) + "秒" + label, color);
    } else if (type === "clock") {
      this.freezeEnemies(10 * durationMult);
      AudioFX.freeze();
      ParticleSystem.spawnText(player.center().x, player.y - 8, Math.round(10 * durationMult) + "秒" + label, color);
    }
  }

  destroyAllEnemies() {
    const targets = this.tanks.filter((tank) => tank.alive && tank.team === "red");
    targets.forEach((target) => {
      target.hp = 0;
      this.killTank(target, this.player);
    });
  }

  freezeEnemies(duration) {
    this.freezeTimer = duration;
    this.tanks.forEach((tank) => {
      if (tank.team === "red") {
        tank.freezeTimer = duration;
        ParticleSystem.spawnFreeze(tank.center().x, tank.center().y);
      }
    });
  }

  isRectFree(x, y, size, ignoreTank) {
    const rect = { x, y, w: size, h: size };
    if (this.map && this.map.blocked(rect, false)) return false;
    for (let i = 0; i < this.tanks.length; i++) {
      const tank = this.tanks[i];
      if (tank === ignoreTank || !tank.alive) continue;
      if (Utils.rectsOverlap(rect, tank.rect())) return false;
    }
    return true;
  }

  findSafeSpawn(x, y, size, ignoreTank) {
    if (this.isRectFree(x, y, size, ignoreTank)) return { x, y };
    const step = 2;
    const maxRadius = GameConfig.TILE_SIZE * 4;
    for (let radius = step; radius <= maxRadius; radius += step) {
      for (let dy = -radius; dy <= radius; dy += step) {
        for (let dx = -radius; dx <= radius; dx += step) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px + size > GameConfig.LOGICAL_WIDTH || py + size > GameConfig.LOGICAL_HEIGHT) {
            continue;
          }
          if (this.isRectFree(px, py, size, ignoreTank)) return { x: px, y: py };
        }
      }
    }
    return null;
  }

  resolveTankCollisions() {
    if (!this.map) return;
    this.tanks.forEach((tank) => {
      tank.resolveCollision(this.map, this.tanks);
    });
  }

  pruneDeadTanks() {
    if (this.modeName === "brawl") return;
    this.tanks = this.tanks.filter((tank) => tank.alive);
    if (this.player && !this.player.alive && !this.tanks.includes(this.player)) {
      this.player = null;
    }
  }

  spawnPlayer(x, y, opts) {
    const hp = (opts && opts.hp) || 3;
    const skinStats = EconomyStore.applySkinStats(GameConfig.PLAYER);
    const finalHp = Math.max(1, Math.round(hp * skinStats.armor));
    const safe = this.findSafeSpawn(x, y, GameConfig.PLAYER.size, null);
    if (safe) {
      x = safe.x;
      y = safe.y;
    }
    const player = new Tank({
      x,
      y,
      size: GameConfig.PLAYER.size,
      team: "blue",
      isPlayer: true,
      hp: finalHp,
      maxHp: finalHp,
      speed: skinStats.speed,
      color: skinStats.skin.colors.body,
      accent: skinStats.skin.colors.accent,
      fireInterval: skinStats.fireInterval,
      bulletSpeed: skinStats.bulletSpeed,
      bulletDamage: skinStats.bulletDamage,
      skinConfig: skinStats.skin,
      invincibleTimer: 2.5,
      spawnTimer: 0.6
    });
    this.player = player;
    this.tanks.push(player);
    player.resolveCollision(this.map, this.tanks);
    if (this.modeName === "survival") {
      this.playerMaxHp = finalHp;
      this.playerHp = finalHp;
    }
    return player;
  }

  spawnTank(opts) {
    let x = opts.x;
    let y = opts.y;
    const size = opts.size || 26;
    if (opts.safe) {
      const safe = this.findSafeSpawn(x, y, size, null);
      if (safe) {
        x = safe.x;
        y = safe.y;
      }
    }
    const rect = { x, y, w: size, h: size };
    if (this.map.blocked(rect, false)) return null;
    for (let i = 0; i < this.tanks.length; i++) {
      const tank = this.tanks[i];
      if (tank.alive && Utils.rectsOverlap(rect, tank.rect())) return null;
    }
    opts.x = x;
    opts.y = y;
    const tank = new Tank(opts);
    this.tanks.push(tank);
    return tank;
  }

  respawnPlayer() {
    if (!this.mode || this.ended) return;
    const spawn = this.mode.getPlayerSpawn();
    const hp = this.modeName === "survival" ? Math.max(1, this.playerHp) : 1;
    this.spawnPlayer(spawn.x, spawn.y, { hp });
    this.player.firepower = Math.max(1, this.player.firepower || 1);
  }

  addScore(amount, x, y, label) {
    this.score += amount;
    if (x !== undefined && y !== undefined) {
      ParticleSystem.spawnText(x, y, label || "+" + amount, "#ffd166");
    }
  }

  endGame(won, reason) {
    if (this.ended) return;
    this.ended = true;
    this.state = "ended";
    const extra = this.mode ? this.mode.getExtraStat() : 0;
    if (won) {
      this.coinsEarned += ECONOMY_CONFIG.rewards.winBonus;
    }
    const coinsAdded = EconomyStore.addCoins(this.coinsEarned, true);
    EconomyStore.recordGameResult(this.modeName, this.kills, extra, won);
    AudioFX.stopMusic();
    if (won) AudioFX.win();
    else AudioFX.gameOver();

    const result = SaveManager.submitScore(this.modeName, this.score, extra);
    document.getElementById("resultTitle").textContent = won ? "任务完成" : reason || "游戏结束";
    document.getElementById("resultScore").textContent = this.score;
    document.getElementById("resultKills").textContent = this.kills;
    document.getElementById("resultBest").textContent = result.high;
    document.getElementById("resultCoins").textContent = "+" + coinsAdded;
    document.getElementById("resultFragments").textContent = EconomyStore.getFragments();
    const labelMap = { classic: "到达关卡", survival: "到达波次", brawl: "本场结果" };
    document.getElementById("resultExtraLabel").textContent = labelMap[this.modeName] || "进度";
    document.getElementById("resultExtra").textContent =
      this.modeName === "brawl" ? (extra ? "胜利" : "战败") : extra;
    document.getElementById("result").classList.remove("hidden");
    this.updateMenuRecords();
    MetaUI.refresh();
  }

  quitToMenu() {
    this.state = "menu";
    this.ended = true;
    AudioFX.stopMusic();
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("pauseOverlay").classList.add("hidden");
    document.getElementById("result").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");
    this.updateMenuRecords();
  }

  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      AudioFX.stopMusic();
      document.getElementById("pauseOverlay").classList.remove("hidden");
    } else if (this.state === "paused") {
      this.state = "playing";
      AudioFX.startMusic(this.modeName);
      document.getElementById("pauseOverlay").classList.add("hidden");
    }
  }

  updateMenuRecords() {
    const progress = SaveManager.get("progress", {});
    document.getElementById("recClassic").textContent = "第 " + (progress.classicLevel || 1) + " 关";
    document.getElementById("recSurvival").textContent = "第 " + (progress.survivalWave || 1) + " 波";
    document.getElementById("recBrawl").textContent = (progress.brawlWins || 0) + " 场";
    document.getElementById("recKills").textContent = progress.totalKills || 0;
    if (MetaUI && MetaUI.renderMenuMeta) MetaUI.renderMenuMeta();
  }

  updateHud() {
    if (this.state !== "playing" || !this.mode) return;
    const hud = this.mode.getHud();
    document.getElementById("hudScore").querySelector("b").textContent = hud.score;
    document.getElementById("hudHigh").querySelector("b").textContent = hud.high;
    document.getElementById("hudLife").querySelector("b").textContent = hud.lifeValue;
    document.getElementById("hudLife").querySelector(".hud-label").textContent = hud.lifeLabel;
    document.getElementById("hudWave").querySelector("b").textContent = hud.waveValue;
    document.getElementById("hudWave").querySelector(".hud-label").textContent = hud.waveLabel;
    document.getElementById("hudTimer").querySelector("b").textContent = hud.timerValue;
    document.getElementById("hudTimer").querySelector(".hud-label").textContent = hud.timerLabel;
    document.getElementById("hudCoins").querySelector("b").textContent = EconomyStore.getCoins();
    const power = this.player ? Math.min(GameConfig.PLAYER.maxFirepower, this.player.firepower) : 1;
    document.getElementById("hudPower").querySelector("b").textContent =
      power === 1 ? "I" : power === 2 ? "II" : "III";

    const pills = document.getElementById("statusPills");
    pills.innerHTML = "";
    if (this.player && this.player.invincibleTimer > 0) {
      pills.appendChild(this.makePill("无敌 " + Math.ceil(this.player.invincibleTimer) + "s", "#8fd0ff"));
    }
    if (this.freezeTimer > 0) {
      pills.appendChild(this.makePill("冻结 " + Math.ceil(this.freezeTimer) + "s", "#7fd8ff"));
    }
    if (this.map && this.map.temporarySteel.length) {
      pills.appendChild(this.makePill("钢墙 " + Math.ceil(this.map.temporarySteel[0].remaining) + "s", "#c7d0d8"));
    }
  }

  makePill(text, color) {
    const el = document.createElement("span");
    el.className = "pill";
    el.textContent = text;
    el.style.borderColor = color;
    el.style.color = color;
    return el;
  }

  draw(time) {
    const ctx = this.ctx;
    ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
    ctx.clearRect(0, 0, GameConfig.LOGICAL_WIDTH, GameConfig.LOGICAL_HEIGHT);
    if (this.settings.shake && this.shake > 0) {
      ctx.save();
      ctx.translate(
        Utils.randomBetween(-this.shake, this.shake) * 0.5,
        Utils.randomBetween(-this.shake, this.shake) * 0.5
      );
    }

    if (this.map) {
      this.map.drawGround(ctx, time);
      this.powerups.forEach((powerup) => powerup.draw(ctx, time));
      this.tanks.forEach((tank) => tank.draw(ctx, time));
      this.bullets.forEach((bullet) => bullet.draw(ctx));
      this.map.drawTrees(ctx, time);
    } else {
      ctx.fillStyle = "#131d2a";
      ctx.fillRect(0, 0, GameConfig.LOGICAL_WIDTH, GameConfig.LOGICAL_HEIGHT);
    }

    ParticleSystem.draw(ctx);
    if (this.freezeTimer > 0 && this.settings.particles) {
      ctx.fillStyle = "rgba(120, 200, 255, 0.10)";
      ctx.fillRect(0, 0, GameConfig.LOGICAL_WIDTH, GameConfig.LOGICAL_HEIGHT);
    }

    if (this.settings.shake && this.shake > 0) {
      ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
