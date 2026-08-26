/**
 * 敌人 AI：四种性格（激进、狙击、游击、团队）+ 经典模式随机游走。
 * 所有决策都基于视线、距离与可行方向，无需地图寻路库。
 */
const TankAI = (() => {
  const DIRS = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 }
  ];

  function tankCenter(tank) {
    return tank.center();
  }

  function nearestEnemy(tank, tanks) {
    const center = tankCenter(tank);
    let best = null;
    let bestDist = Infinity;
    tanks.forEach((other) => {
      if (other === tank || !other.alive || other.team === tank.team) return;
      const d = Utils.dist(center.x, center.y, other.center().x, other.center().y);
      if (d < bestDist) {
        bestDist = d;
        best = other;
      }
    });
    return best;
  }

  function nearestAlly(tank, tanks) {
    const center = tankCenter(tank);
    let best = null;
    let bestDist = Infinity;
    tanks.forEach((other) => {
      if (other === tank || !other.alive || other.team !== tank.team) return;
      const d = Utils.dist(center.x, center.y, other.center().x, other.center().y);
      if (d < bestDist) {
        bestDist = d;
        best = other;
      }
    });
    return best;
  }

  function aimDirection(tank, target) {
    if (!target) return tank.direction;
    const a = tankCenter(tank);
    const b = tankCenter(target);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) > Math.abs(dy)) return { x: Math.sign(dx), y: 0 };
    return { x: 0, y: Math.sign(dy) };
  }

  function targetVisible(tank, target, map) {
    if (!target || !target.alive) return false;
    if (target.ghostTimer > 0) return false;
    const a = tankCenter(tank);
    const b = tankCenter(target);
    return map.lineOfSight(a.x, a.y, b.x, b.y);
  }

  function canMoveDir(tank, dir, map, tanks) {
    const probe = {
      x: tank.x + dir.x * 12,
      y: tank.y + dir.y * 12,
      w: tank.w,
      h: tank.h
    };
    if (map.blocked(probe, false)) return false;
    for (let i = 0; i < tanks.length; i++) {
      const other = tanks[i];
      if (other === tank || !other.alive) continue;
      if (Utils.rectsCollide(probe, other.rect(), 2)) return false;
    }
    return true;
  }

  function scoreDirection(tank, dir, target, behavior, distance) {
    let score = Math.random() * 0.35;
    if (!target) return score;
    const dot = dir.x * (target.center().x - tank.center().x) + dir.y * (target.center().y - tank.center().y);
    if (behavior === "aggressive" || behavior === "classic") {
      score += dot > 0 ? 0.7 : -0.25;
    } else if (behavior === "sniper") {
      if (distance < tank.preferredRange * 0.75) {
        score -= dot > 0 ? 0.55 : 0.15;
      } else if (distance > tank.preferredRange * 1.5) {
        score += dot > 0 ? 0.6 : -0.3;
      } else {
        score += Math.abs(dir.x) + Math.abs(dir.y) * 0.2;
      }
    } else if (behavior === "guerrilla") {
      score += (Math.abs(dir.x) + Math.abs(dir.y)) * 0.4 + (dot > 0 ? -0.1 : 0.15);
    } else if (behavior === "team") {
      score += dot > 0 ? 0.5 : -0.2;
    }
    return score;
  }

  function pickDirection(tank, target, tanks, map, behavior) {
    const distance = target ? Utils.dist(tank.center().x, tank.center().y, target.center().x, target.center().y) : 999;
    const options = DIRS.slice();
    options.sort((a, b) => scoreDirection(tank, b, target, behavior, distance) - scoreDirection(tank, a, target, behavior, distance));
    for (let i = 0; i < options.length; i++) {
      if (canMoveDir(tank, options[i], map, tanks)) return options[i];
    }
    return tank.direction;
  }

  function update(tank, game, dt) {
    if (!tank.alive || tank.spawnTimer > 0) return;
    if (tank.freezeTimer > 0) return;

    const tanks = game.tanks;
    const map = game.map;
    const profile = tank.profile || {};
    const behavior = tank.profileKey || tank.roleBehavior || "classic";
    if (tank.targetCacheTimer > 0) {
      tank.targetCacheTimer -= dt;
    } else {
      tank.targetCache = nearestEnemy(tank, tanks) || game.player;
      tank.targetCacheTimer = 0.12;
    }
    const target = tank.targetCache;
    const distance = target && target.alive ? Utils.dist(tank.center().x, tank.center().y, target.center().x, target.center().y) : 999;
    const preferredRange = tank.preferredRange || profile.preferRange || 220;
    tank.preferredRange = preferredRange;
    tank.roleBehavior = tank.roleBehavior || "classic";

    if (behavior === "team") {
      if (tank.allyCacheTimer > 0) {
        tank.allyCacheTimer -= dt;
      } else {
        tank.allyCache = nearestAlly(tank, tanks);
        tank.allyCacheTimer = 0.12;
      }
      const ally = tank.allyCache;
      if (ally && Utils.dist(tank.center().x, tank.center().y, ally.center().x, ally.center().y) > 230) {
        const dir = aimDirection(tank, ally);
        if (canMoveDir(tank, dir, map, tanks)) tank.setDirection(dir);
      }
    }

    tank.thinkTimer -= dt;
    if (tank.moveCheckTimer > 0) {
      tank.moveCheckTimer -= dt;
    } else {
      tank.canMoveCache = canMoveDir(tank, tank.direction, map, tanks);
      tank.moveCheckTimer = 0.08;
    }
    if (tank.thinkTimer <= 0 || !tank.canMoveCache) {
      const dir = pickDirection(tank, target, tanks, map, behavior);
      tank.setDirection(dir);
      const baseTimer = behavior === "guerrilla" ? 0.45 : behavior === "sniper" ? 1.1 : behavior === "team" ? 0.85 : 1.0;
      tank.thinkTimer = baseTimer * Utils.randomBetween(0.7, 1.4);
    }

    const speed = tank.speed * (behavior === "guerrilla" ? 1.15 : 1);
    tank.move(tank.direction.x * speed * dt, tank.direction.y * speed * dt, map, tanks);

    if (tank.postShotTimer > 0) {
      tank.postShotTimer -= dt;
      if (tank.postShotTimer <= 0) {
        tank.thinkTimer = 0.05;
      }
    }

    if (tank.visibilityTimer > 0) {
      tank.visibilityTimer -= dt;
    } else {
      tank.visibleCache = targetVisible(tank, target, map);
      tank.visibilityTimer = 0.1;
    }
    const visible = tank.visibleCache;
    let shouldShoot = false;
    if (visible && tank.fireTimer <= 0) {
      if (behavior === "aggressive") shouldShoot = distance < 460;
      else if (behavior === "sniper") shouldShoot = distance > 90 && distance < 520;
      else if (behavior === "guerrilla") shouldShoot = distance < 260 && tank.postShotTimer <= 0;
      else if (behavior === "team") shouldShoot = distance < 380;
      else shouldShoot = distance < 330 || Math.random() < 0.5;
    }

    if (shouldShoot) {
      tank.setDirection(aimDirection(tank, target));
      game.fireTank(tank);
      if (behavior === "guerrilla") {
        tank.postShotTimer = 0.65;
        tank.thinkTimer = 0.05;
      }
    }
  }

  return { update, nearestEnemy, aimDirection };
})();
