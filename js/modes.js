/**
 * 三种游戏模式：
 * classic 守卫基地逐关推进；survival 无尽波次；brawl 3v3 团队乱斗。
 */

function weightedRole(weights, rand) {
  const total = Object.keys(weights).reduce((sum, key) => sum + weights[key], 0);
  let roll = (rand || Math.random)() * total;
  const keys = Object.keys(weights);
  for (let i = 0; i < keys.length; i++) {
    roll -= weights[keys[i]];
    if (roll <= 0) return keys[i];
  }
  return keys[0];
}

class GameMode {
  constructor(game, name) {
    this.game = game;
    this.name = name;
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
  }

  getHud() {
    return {};
  }

  getExtraStat() {
    return 0;
  }

  getPlayerSpawn() {
    return { x: 450, y: 546 };
  }

  onEnemyKilled() {}

  onPlayerKilled() {}
}

class ClassicMode extends GameMode {
  constructor(game) {
    super(game, "classic");
    this.level = 1;
    this.spawnQueue = [];
    this.spawnTimer = 1.3;
    this.levelClearTimer = -1;
  }

  init() {
    this.startLevel(1, true);
  }

  startLevel(level, fresh) {
    this.level = level;
    this.game.map = MapFactory.build("classic", level);
    this.game.resolveTankCollisions();
    this.spawnQueue = this.buildQueue(level);
    this.spawnTimer = 1.2;
    this.levelClearTimer = -1;
    if (fresh) {
      this.game.playerLives = GameConfig.MODES.classic.initialLives;
      this.game.spawnPlayer(this.getPlayerSpawn().x, this.getPlayerSpawn().y, { hp: 1 });
    } else if (!this.game.player || !this.game.player.alive) {
      this.game.respawnPlayer();
    }
    if (level > 1) {
      this.game.addScore(500, GameConfig.LOGICAL_WIDTH / 2, 70, "关卡奖励 +500");
    }
  }

  buildQueue(level) {
    const weights = {
      normal: Math.max(4, 11 - level),
      fast: 3 + Math.floor(level * 0.9),
      armored: 2 + Math.floor(level * 0.8),
      heavy: 1 + Math.floor(level * 0.5)
    };
    const count = GameConfig.MODES.classic.enemiesPerLevel;
    const queue = [];
    for (let i = 0; i < count; i++) queue.push(weightedRole(weights));
    return Utils.shuffle(queue);
  }

  update(dt) {
    super.update(dt);
    if (this.game.ended) return;
    if (this.levelClearTimer > 0) {
      this.levelClearTimer -= dt;
      if (this.levelClearTimer <= 0) {
        this.startLevel(this.level + 1, false);
      }
      return;
    }
    if (!this.game.map.hasBase()) {
      this.game.endGame(false, "基地被摧毁");
      return;
    }
    this.spawnTimer -= dt;
    const active = this.activeCount();
    if (this.spawnQueue.length && active < GameConfig.MODES.classic.maxActive && this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnTimer = 1.25;
    }
    if (!this.spawnQueue.length && active === 0 && this.levelClearTimer < 0) {
      this.levelClearTimer = 2.2;
      this.game.addScore(1000, GameConfig.LOGICAL_WIDTH / 2, 90, "本关通关 +1000");
    }
  }

  activeCount() {
    return this.game.tanks.filter((t) => t.team === "red" && t.alive).length;
  }

  spawnEnemy() {
    const role = this.spawnQueue.shift();
    if (!role) return;
    const spec = GameConfig.ENEMY_TYPES[role];
    const points = Utils.shuffle(MapFactory.spawnPoints("classic"));
    for (let i = 0; i < points.length; i++) {
      const tank = this.game.spawnTank({
        x: points[i].x - 13,
        y: 4,
        size: 26,
        role,
        team: "red",
        hp: spec.hp,
        speed: spec.speed,
        color: spec.color,
        accent: spec.accent,
        score: spec.score,
        fireInterval: spec.fireInterval,
        bulletSpeed: spec.bulletSpeed,
        spread: spec.spread
      });
      if (tank) {
        tank.roleBehavior = role === "fast" ? "guerrilla" : role === "armored" ? "aggressive" : role === "heavy" ? "sniper" : "classic";
        tank.y = 4;
        return;
      }
    }
    this.spawnQueue.unshift(role);
  }

  onPlayerKilled() {
    this.game.playerLives--;
    if (this.game.playerLives <= 0) {
      this.game.endGame(false, "坦克耗尽");
    } else {
      this.game.respawnTimer = GameConfig.MODES.classic.respawnDelay;
    }
  }

  getHud() {
    return {
      score: this.game.score,
      high: SaveManager.get("highScores.classic", 0),
      lifeLabel: "生命",
      lifeValue: this.game.playerLives,
      waveLabel: "关卡",
      waveValue: this.level,
      timerLabel: "时间",
      timerValue: Utils.formatTime(this.time)
    };
  }

  getExtraStat() {
    return this.level;
  }

  getPlayerSpawn() {
    return { x: 14 * GameConfig.TILE_SIZE + 2, y: 17 * GameConfig.TILE_SIZE + 2 };
  }
}

class SurvivalMode extends GameMode {
  constructor(game) {
    super(game, "survival");
    this.wave = 1;
    this.spawnQueue = [];
    this.spawnTimer = 0.8;
    this.waveClearTimer = -1;
  }

  init() {
    this.wave = 1;
    this.game.playerMaxHp = GameConfig.MODES.survival.initialHp;
    this.game.playerHp = this.game.playerMaxHp;
    this.startWave(1, true);
  }

  startWave(wave, fresh) {
    this.wave = wave;
    this.game.map = MapFactory.build("survival", wave);
    this.game.resolveTankCollisions();
    this.spawnQueue = this.buildQueue(wave);
    this.spawnTimer = 0.7;
    this.waveClearTimer = -1;
    const spawn = this.getPlayerSpawn();
    if (fresh) {
      this.game.spawnPlayer(spawn.x, spawn.y, { hp: this.game.playerMaxHp });
    } else {
      this.game.playerHp = Math.min(this.game.playerMaxHp, this.game.playerHp + 1);
      if (!this.game.player || !this.game.player.alive) {
        this.game.respawnPlayer();
      }
      this.game.addScore(300 + this.wave * 100, GameConfig.LOGICAL_WIDTH / 2, 80, "波次奖励");
    }
  }

  buildQueue(wave) {
    const weights = {
      normal: Math.max(2, 7 - Math.floor(wave * 0.6)),
      fast: 3 + Math.floor(wave * 0.7),
      armored: 2 + Math.floor(wave * 0.5),
      heavy: Math.min(6, 1 + Math.floor(wave * 0.4))
    };
    const count = GameConfig.MODES.survival.waveBase + wave * 2;
    const queue = [];
    for (let i = 0; i < count; i++) queue.push(weightedRole(weights));
    return Utils.shuffle(queue);
  }

  update(dt) {
    super.update(dt);
    if (this.game.ended) return;
    if (this.waveClearTimer > 0) {
      this.waveClearTimer -= dt;
      if (this.waveClearTimer <= 0) this.startWave(this.wave + 1, false);
      return;
    }
    this.spawnTimer -= dt;
    const active = this.activeCount();
    if (this.spawnQueue.length && active < GameConfig.MODES.survival.maxActive && this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnTimer = 1.05;
    }
    if (!this.spawnQueue.length && active === 0 && this.waveClearTimer < 0) {
      this.waveClearTimer = 2.1;
      this.game.addScore(500 + this.wave * 100, GameConfig.LOGICAL_WIDTH / 2, 80, "第 " + this.wave + " 波完成");
    }
  }

  activeCount() {
    return this.game.tanks.filter((t) => t.team === "red" && t.alive).length;
  }

  spawnEnemy() {
    const role = this.spawnQueue.shift();
    if (!role) return;
    const spec = GameConfig.ENEMY_TYPES[role];
    const points = MapFactory.spawnPoints("survival");
    const shuffled = Utils.shuffle(points);
    const speedMult = 1 + Math.min(0.35, this.wave * 0.018);
    for (let i = 0; i < shuffled.length; i++) {
      const point = shuffled[i];
      const tank = this.game.spawnTank({
        x: point.x - 13,
        y: point.y - 13,
        size: 26,
        role,
        team: "red",
        hp: spec.hp,
        speed: spec.speed * speedMult,
        color: spec.color,
        accent: spec.accent,
        score: spec.score,
        fireInterval: spec.fireInterval,
        bulletSpeed: spec.bulletSpeed,
        spread: spec.spread
      });
      if (tank) {
        tank.roleBehavior = role === "fast" ? "guerrilla" : role === "armored" ? "aggressive" : role === "heavy" ? "sniper" : "classic";
        return;
      }
    }
    this.spawnQueue.unshift(role);
  }

  onPlayerKilled() {
    this.game.endGame(false, "生命值耗尽");
  }

  getHud() {
    return {
      score: this.game.score,
      high: SaveManager.get("highScores.survival", 0),
      lifeLabel: "生命",
      lifeValue: this.game.playerHp + "/" + this.game.playerMaxHp,
      waveLabel: "波次",
      waveValue: this.wave,
      timerLabel: "存活",
      timerValue: Utils.formatTime(this.time)
    };
  }

  getExtraStat() {
    return this.wave;
  }

  getPlayerSpawn() {
    return { x: GameConfig.LOGICAL_WIDTH / 2 - 14, y: GameConfig.LOGICAL_HEIGHT / 2 - 14 };
  }
}

class BrawlMode extends GameMode {
  constructor(game) {
    super(game, "brawl");
    this.timeLeft = GameConfig.MODES.brawl.duration;
    this.blueScore = 0;
    this.redScore = 0;
  }

  init() {
    this.timeLeft = GameConfig.MODES.brawl.duration;
    this.blueScore = 0;
    this.redScore = 0;
    this.game.map = MapFactory.build("brawl");
    const points = MapFactory.spawnPoints("brawl");
    const blue = points.blue;
    const red = points.red;
    const teamSize = GameConfig.MODES.brawl.teamSize;
    const redProfiles = ["aggressive", "sniper", "guerrilla"];
    this.game.spawnPlayer(blue[0].x - 14, blue[0].y - 14, { hp: 5 });
    for (let i = 1; i < teamSize; i++) {
      this.spawnProfileTank("team", blue[i], "blue", 0.92 + (i - 1) * 0.16);
    }
    for (let i = 0; i < teamSize; i++) {
      this.spawnProfileTank(redProfiles[i % redProfiles.length], red[i], "red", 1);
    }
  }

  spawnProfileTank(profileKey, point, team, speedMult) {
    const profile = GameConfig.AI_PROFILES[profileKey];
    const half = 13;
    return this.game.spawnTank({
      x: point.x - half,
      y: point.y - half,
      size: 26,
      safe: true,
      role: "brawler",
      team,
      profile,
      profileKey: profileKey,
      hp: profile.hp,
      speed: profile.speed * (speedMult || 1),
      color: profile.color,
      accent: profile.accent,
      score: profile.score,
      fireInterval: profile.fireInterval,
      bulletSpeed: profile.bulletSpeed,
      spread: profile.spread
    });
  }

  update(dt) {
    super.update(dt);
    if (this.game.ended) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.game.endGame(this.blueScore >= this.redScore, this.blueScore === this.redScore ? "平局" : this.blueScore > this.redScore ? "胜利" : "战败");
      return;
    }
    const points = MapFactory.spawnPoints("brawl");
    this.game.tanks.forEach((tank) => {
      if (tank.alive) return;
      tank.respawnTimer -= dt;
      if (tank.respawnTimer <= 0) {
        const list = tank.team === "blue" ? points.blue : points.red;
        const spawn = this.freeSpawn(list, tank);
        if (spawn) {
          const half = tank.w / 2;
          tank.x = spawn.x - half;
          tank.y = spawn.y - half;
          tank.hp = tank.maxHp;
          tank.alive = true;
          tank.spawnTimer = 1.2;
          tank.invincibleTimer = 1.5;
          tank.fireTimer = 0.5;
          tank.respawnTimer = 9999;
          tank.resolveCollision(this.game.map, this.game.tanks);
        }
      }
    });
  }

  freeSpawn(list, tank) {
    const shuffled = Utils.shuffle(list);
    for (let i = 0; i < shuffled.length; i++) {
      const point = shuffled[i];
      const size = tank ? tank.w : GameConfig.PLAYER.size;
      const half = size / 2;
      const rect = { x: point.x - half, y: point.y - half, w: size, h: size };
      if (this.game.map.blocked(rect, false)) continue;
      let free = true;
      this.game.tanks.forEach((t) => {
        if (t.alive && Utils.rectsCollide(rect, t.rect(), 1)) free = false;
      });
      if (free) return point;
    }
    return null;
  }

  onEnemyKilled(target) {
    if (target.team === "red") this.blueScore += target.score;
    else this.redScore += target.score;
    this.game.score = this.blueScore;
    target.respawnTimer = GameConfig.MODES.brawl.respawnDelay;
    this.game.particles.spawnText(target.x, target.y - 8, target.team === "red" ? "+" + target.score : "敌方得分", target.team === "red" ? "#ffd166" : "#ff8f8f");
  }

  onPlayerKilled() {
    if (this.game.player) {
      this.game.player.respawnTimer = GameConfig.MODES.brawl.respawnDelay;
    }
  }

  getHud() {
    return {
      score: this.blueScore,
      high: SaveManager.get("highScores.brawl", 0),
      lifeLabel: "敌队",
      lifeValue: this.redScore,
      waveLabel: "时间",
      waveValue: Utils.formatTime(this.timeLeft),
      timerLabel: "时间",
      timerValue: Utils.formatTime(this.timeLeft)
    };
  }

  getExtraStat() {
    return this.blueScore > this.redScore ? 1 : 0;
  }

  getPlayerSpawn() {
    const point = MapFactory.spawnPoints("brawl").blue[0];
    return { x: point.x - 14, y: point.y - 14 };
  }
}
