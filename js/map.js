/**
 * 战场地图：瓦片网格、地图生成、瓦片绘制与临时钢墙效果。
 */
const TILE = Object.freeze({
  EMPTY: 0,
  BRICK: 1,
  STEEL: 2,
  WATER: 3,
  TREE: 4,
  BASE: 5
});

class GameMap {
  constructor(cols, rows) {
    this.cols = cols || Math.floor(GameConfig.LOGICAL_WIDTH / GameConfig.TILE_SIZE);
    this.rows = rows || Math.floor(GameConfig.LOGICAL_HEIGHT / GameConfig.TILE_SIZE);
    this.tile = GameConfig.TILE_SIZE;
    this.grid = [];
    this.temporarySteel = [];
    this.baseAlive = true;
    this.cacheCanvas = null;
    this.cacheDirty = true;
    for (let y = 0; y < this.rows; y++) {
      this.grid.push(new Array(this.cols).fill(TILE.EMPTY));
    }
  }

  static empty(cols, rows) {
    return new GameMap(cols, rows);
  }

  fillRect(col, row, width, height, type) {
    for (let y = row; y < row + height; y++) {
      for (let x = col; x < col + width; x++) {
        if (y >= 0 && y < this.rows && x >= 0 && x < this.cols) {
          this.grid[y][x] = type;
          this.cacheDirty = true;
        }
      }
    }
  }

  setTile(col, row, type) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.grid[row][col] = type;
      this.cacheDirty = true;
    }
  }

  tileAt(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return TILE.STEEL;
    return this.grid[row][col];
  }

  tileAtPixel(x, y) {
    return this.tileAt(Math.floor(x / this.tile), Math.floor(y / this.tile));
  }

  isSolidTile(type, bulletPass) {
    if (bulletPass) {
      return type === TILE.BRICK || type === TILE.STEEL || type === TILE.BASE;
    }
    return type === TILE.BRICK || type === TILE.STEEL || type === TILE.WATER || type === TILE.BASE;
  }

  blocked(rect, bulletPass) {
    const left = Math.floor(rect.x / this.tile);
    const right = Math.floor((rect.x + rect.w - 0.01) / this.tile);
    const top = Math.floor(rect.y / this.tile);
    const bottom = Math.floor((rect.y + rect.h - 0.01) / this.tile);
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        if (this.isSolidTile(this.tileAt(col, row), bulletPass)) return true;
      }
    }
    return false;
  }

  /**
   * 取样直线视线：用于 AI 判断能否开火。
   */
  lineOfSight(x1, y1, x2, y2) {
    const distance = Utils.dist(x1, y1, x2, y2);
    const steps = Math.ceil(distance / 8);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Utils.lerp(x1, x2, t);
      const y = Utils.lerp(y1, y2, t);
      const type = this.tileAtPixel(x, y);
      if (this.isSolidTile(type, true)) return false;
    }
    return true;
  }

  destroyBrickAtPixel(x, y) {
    const col = Math.floor(x / this.tile);
    const row = Math.floor(y / this.tile);
    if (this.grid[row] && this.grid[row][col] === TILE.BRICK) {
      this.grid[row][col] = TILE.EMPTY;
      this.cacheDirty = true;
      return true;
    }
    return false;
  }

  destroyBase() {
    if (!this.baseAlive) return false;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.grid[row][col] === TILE.BASE) {
          this.grid[row][col] = TILE.EMPTY;
          this.cacheDirty = true;
        }
      }
    }
    this.baseAlive = false;
    return true;
  }

  hasBase() {
    return this.baseAlive;
  }

  findBase() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.grid[row][col] === TILE.BASE) {
          return {
            x: col * this.tile,
            y: row * this.tile,
            w: this.tile,
            h: this.tile
          };
        }
      }
    }
    return null;
  }

  /**
   * 铲子道具：把某点附近的砖墙临时升级为钢墙，到期后恢复原样。
   */
  steelizeAround(centerX, centerY, radiusTiles) {
    const base = this.findBase();
    const target = base || {
      x: centerX - this.tile,
      y: centerY - this.tile,
      w: this.tile * 2,
      h: this.tile * 2
    };
    const left = Math.floor(target.x / this.tile) - radiusTiles;
    const right = Math.floor((target.x + target.w - 1) / this.tile) + radiusTiles;
    const top = Math.floor(target.y / this.tile) - radiusTiles;
    const bottom = Math.floor((target.y + target.h - 1) / this.tile) + radiusTiles;
    const changed = [];
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        const type = this.tileAt(col, row);
        if (type === TILE.BRICK) {
          this.grid[row][col] = TILE.STEEL;
          changed.push({ col, row, original: type });
        }
      }
    }
    if (changed.length) {
      this.temporarySteel.push({ changed, remaining: 20 });
      this.cacheDirty = true;
    }
  }

  restoreSteel() {
    for (let i = this.temporarySteel.length - 1; i >= 0; i--) {
      const group = this.temporarySteel[i];
      group.changed.forEach((cell) => {
        this.setTile(cell.col, cell.row, cell.original);
      });
      this.temporarySteel.splice(i, 1);
    }
  }

  update(dt) {
    for (let i = this.temporarySteel.length - 1; i >= 0; i--) {
      const group = this.temporarySteel[i];
      group.remaining -= dt;
      if (group.remaining <= 0) {
        group.changed.forEach((cell) => {
          this.setTile(cell.col, cell.row, cell.original);
        });
        this.temporarySteel.splice(i, 1);
      }
    }
  }

  drawGround(ctx, time) {
    if (!this.cacheCanvas) {
      this.cacheCanvas = document.createElement("canvas");
      this.cacheCanvas.width = GameConfig.LOGICAL_WIDTH;
      this.cacheCanvas.height = GameConfig.LOGICAL_HEIGHT;
      this.cacheDirty = true;
    }
    if (this.cacheDirty) {
      const cacheCtx = this.cacheCanvas.getContext("2d");
      for (let row = 0; row < this.rows; row++) {
        for (let col = 0; col < this.cols; col++) {
          const type = this.grid[row][col];
          const x = col * this.tile;
          const y = row * this.tile;
          cacheCtx.fillStyle = ((col + row) % 2 === 0) ? "#182330" : "#1a2533";
          cacheCtx.fillRect(x, y, this.tile, this.tile);
          if (type === TILE.BRICK) {
            this.drawBrick(x, y, cacheCtx);
          } else if (type === TILE.STEEL) {
            this.drawSteel(x, y, cacheCtx);
          } else if (type === TILE.BASE) {
            this.drawBase(x, y, cacheCtx);
          }
        }
      }
      this.cacheDirty = false;
    }
    ctx.save();
    ctx.drawImage(this.cacheCanvas, 0, 0);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const type = this.grid[row][col];
        if (type !== TILE.WATER) continue;
        const x = col * this.tile;
        const y = row * this.tile;
        this.drawWater(x, y, time, ctx);
      }
    }
    ctx.restore();
  }

  drawBrick(x, y, ctx) {
    ctx.fillStyle = "#9a4f2e";
    ctx.fillRect(x, y, this.tile, this.tile);
    ctx.fillStyle = "#b9663a";
    ctx.fillRect(x + 2, y + 2, 12, 10);
    ctx.fillRect(x + 18, y + 2, 12, 10);
    ctx.fillRect(x + 9, y + 16, 12, 10);
    ctx.fillRect(x + 2, y + 18, 6, 12);
    ctx.strokeStyle = "#66301c";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, this.tile - 2, this.tile - 2);
    ctx.beginPath();
    ctx.moveTo(x, y + 14);
    ctx.lineTo(x + this.tile, y + 14);
    ctx.moveTo(x + 16, y);
    ctx.lineTo(x + 16, y + 14);
    ctx.moveTo(x + 8, y + 14);
    ctx.lineTo(x + 8, y + this.tile);
    ctx.stroke();
  }

  drawSteel(x, y, ctx) {
    ctx.fillStyle = "#9aa6b4";
    ctx.fillRect(x, y, this.tile, this.tile);
    ctx.fillStyle = "#c3ccd6";
    ctx.fillRect(x + 3, y + 3, this.tile - 6, this.tile - 6);
    ctx.strokeStyle = "#5c6875";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 2);
    ctx.lineTo(x + this.tile - 2, y + this.tile - 2);
    ctx.moveTo(x + this.tile - 2, y + 2);
    ctx.lineTo(x + 2, y + this.tile - 2);
    ctx.stroke();
    ctx.fillStyle = "#e4e9ee";
    ctx.beginPath();
    ctx.arc(x + 9, y + 9, 2.4, 0, Math.PI * 2);
    ctx.arc(x + this.tile - 9, y + 9, 2.4, 0, Math.PI * 2);
    ctx.arc(x + 9, y + this.tile - 9, 2.4, 0, Math.PI * 2);
    ctx.arc(x + this.tile - 9, y + this.tile - 9, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWater(x, y, time, ctx) {
    const wave = Math.sin(time * 2.4 + x * 0.12 + y * 0.08);
    ctx.fillStyle = "#1d5f86";
    ctx.fillRect(x, y, this.tile, this.tile);
    ctx.strokeStyle = "#55a8d8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 16 + wave * 2);
    ctx.lineTo(x + 12, y + 20 + wave * 2);
    ctx.moveTo(x + 18, y + 9 + wave * 3);
    ctx.lineTo(x + 27, y + 13 + wave * 3);
    ctx.stroke();
  }

  drawBase(x, y, ctx) {
    ctx.fillStyle = "#3e4854";
    ctx.fillRect(x + 2, y + 22, this.tile - 4, this.tile - 22);
    ctx.fillStyle = "#5f6b78";
    ctx.fillRect(x + 6, y + 14, this.tile - 12, 8);
    ctx.fillStyle = "#b8c1cb";
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 4);
    ctx.lineTo(x + this.tile - 10, y + 4);
    ctx.lineTo(x + 8, y + 18);
    ctx.lineTo(x + this.tile - 8, y + 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffcf4d";
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 10);
    ctx.lineTo(x + 18, y + 14);
    ctx.lineTo(x + 22, y + 14);
    ctx.lineTo(x + 19, y + 17);
    ctx.lineTo(x + 20, y + 21);
    ctx.lineTo(x + 16, y + 19);
    ctx.lineTo(x + 12, y + 21);
    ctx.lineTo(x + 13, y + 17);
    ctx.lineTo(x + 10, y + 14);
    ctx.lineTo(x + 14, y + 14);
    ctx.closePath();
    ctx.fill();
  }

  drawTrees(ctx, time) {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.grid[row][col] !== TILE.TREE) continue;
        const x = col * this.tile;
        const y = row * this.tile;
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = "#2f6b42";
        ctx.beginPath();
        ctx.arc(x + 9, y + 12, 9, 0, Math.PI * 2);
        ctx.arc(x + 22, y + 12, 9, 0, Math.PI * 2);
        ctx.arc(x + 16, y + 6, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4c9a62";
        ctx.beginPath();
        ctx.arc(x + 15, y + 8, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

const MapFactory = (() => {
  function emptyMap() {
    return GameMap.empty(
      Math.floor(GameConfig.LOGICAL_WIDTH / GameConfig.TILE_SIZE),
      Math.floor(GameConfig.LOGICAL_HEIGHT / GameConfig.TILE_SIZE)
    );
  }

  function buildClassic(level) {
    const map = emptyMap();
    const rand = Utils.seededRandom(7919 + level * 104729);

    map.fillRect(11, 18, 8, 1, TILE.BRICK);
    map.fillRect(11, 19, 3, 1, TILE.BRICK);
    map.fillRect(16, 19, 3, 1, TILE.BRICK);
    map.setTile(14, 19, TILE.BASE);

    const brickWalls = [
      [1, 1, 3, 2], [8, 1, 4, 2], [18, 1, 4, 2], [26, 1, 3, 2],
      [2, 4, 3, 2], [9, 4, 3, 2], [18, 4, 3, 2], [25, 4, 3, 2],
      [12, 5, 6, 1], [5, 7, 2, 2], [22, 7, 2, 2], [3, 9, 2, 2],
      [25, 9, 2, 2], [2, 12, 3, 2], [25, 12, 3, 2], [6, 13, 2, 2],
      [22, 13, 2, 2], [12, 13, 3, 2], [15, 13, 3, 2], [5, 16, 2, 1],
      [23, 16, 2, 1]
    ];
    brickWalls.forEach((spec, index) => {
      if (rand() < 0.16) return;
      const scale = index % 3 === 0 ? 2 : 1;
      map.fillRect(spec[0], spec[1], spec[2], spec[3], TILE.BRICK);
      if (scale === 2 && rand() < 0.5) {
        map.fillRect(spec[0] + 1, spec[1] + 1, spec[2] - 1, spec[3] - 1, TILE.BRICK);
      }
    });

    map.fillRect(7, 2, 2, 2, TILE.STEEL);
    map.fillRect(21, 2, 2, 2, TILE.STEEL);
    map.fillRect(10, 7, 1, 3, TILE.STEEL);
    map.fillRect(19, 7, 1, 3, TILE.STEEL);
    map.fillRect(4, 11, 2, 2, TILE.STEEL);
    map.fillRect(24, 11, 2, 2, TILE.STEEL);
    map.fillRect(14, 9, 2, 1, TILE.STEEL);

    map.fillRect(1, 11, 2, 1, TILE.WATER);
    map.fillRect(7, 11, 3, 1, TILE.WATER);
    map.fillRect(12, 11, 2, 1, TILE.WATER);
    map.fillRect(20, 11, 3, 1, TILE.WATER);
    map.fillRect(27, 11, 2, 1, TILE.WATER);

    map.fillRect(2, 6, 4, 1, TILE.TREE);
    map.fillRect(15, 6, 3, 1, TILE.TREE);
    map.fillRect(24, 6, 4, 1, TILE.TREE);
    map.fillRect(8, 15, 3, 1, TILE.TREE);
    map.fillRect(19, 15, 3, 1, TILE.TREE);
    return map;
  }

  function buildSurvival(wave) {
    const map = emptyMap();
    const rand = Utils.seededRandom(13337 + wave * 7919);
    const brickCount = 12 + Math.min(14, wave);
    const steelCount = 4 + Math.min(8, Math.floor(wave / 2));

    map.fillRect(0, 0, map.cols, 1, TILE.STEEL);
    map.fillRect(0, map.rows - 1, map.cols, 1, TILE.STEEL);
    map.fillRect(0, 0, 1, map.rows, TILE.STEEL);
    map.fillRect(map.cols - 1, 0, 1, map.rows, TILE.STEEL);

    for (let i = 0; i < brickCount; i++) {
      const col = 1 + Math.floor(rand() * (map.cols - 4));
      const row = 1 + Math.floor(rand() * (map.rows - 4));
      const w = 1 + Math.floor(rand() * 3);
      const h = 1 + Math.floor(rand() * 3);
      map.fillRect(col, row, w, h, TILE.BRICK);
    }
    for (let i = 0; i < steelCount; i++) {
      const col = 2 + Math.floor(rand() * (map.cols - 6));
      const row = 2 + Math.floor(rand() * (map.rows - 6));
      map.fillRect(col, row, 2, 2, TILE.STEEL);
    }
    for (let i = 0; i < 5; i++) {
      const col = 1 + Math.floor(rand() * (map.cols - 4));
      const row = 5 + Math.floor(rand() * 9);
      map.fillRect(col, row, 3, 1, TILE.WATER);
    }
    for (let i = 0; i < 7; i++) {
      const col = 1 + Math.floor(rand() * (map.cols - 4));
      const row = 1 + Math.floor(rand() * (map.rows - 3));
      map.fillRect(col, row, 3, 1, TILE.TREE);
    }
    map.fillRect(1, 1, 2, 2, TILE.EMPTY);
    map.fillRect(map.cols - 3, 1, 2, 2, TILE.EMPTY);
    map.fillRect(1, map.rows - 3, 2, 2, TILE.EMPTY);
    map.fillRect(map.cols - 3, map.rows - 3, 2, 2, TILE.EMPTY);
    map.fillRect(14, 9, 2, 2, TILE.EMPTY);
    return map;
  }

  function buildBrawl() {
    const map = emptyMap();
    map.fillRect(13, 8, 4, 4, TILE.STEEL);
    map.fillRect(8, 4, 3, 2, TILE.BRICK);
    map.fillRect(19, 4, 3, 2, TILE.BRICK);
    map.fillRect(8, 14, 3, 2, TILE.BRICK);
    map.fillRect(19, 14, 3, 2, TILE.BRICK);
    map.fillRect(4, 9, 2, 2, TILE.STEEL);
    map.fillRect(24, 9, 2, 2, TILE.STEEL);
    map.fillRect(11, 5, 2, 1, TILE.BRICK);
    map.fillRect(17, 5, 2, 1, TILE.BRICK);
    map.fillRect(11, 14, 2, 1, TILE.BRICK);
    map.fillRect(17, 14, 2, 1, TILE.BRICK);
    map.fillRect(6, 7, 3, 1, TILE.WATER);
    map.fillRect(21, 7, 3, 1, TILE.WATER);
    map.fillRect(6, 12, 3, 1, TILE.WATER);
    map.fillRect(21, 12, 3, 1, TILE.WATER);
    map.fillRect(3, 3, 3, 1, TILE.TREE);
    map.fillRect(24, 3, 3, 1, TILE.TREE);
    map.fillRect(3, 16, 3, 1, TILE.TREE);
    map.fillRect(24, 16, 3, 1, TILE.TREE);
    return map;
  }

  function build(name, level) {
    if (name === "classic") return buildClassic(level || 1);
    if (name === "survival") return buildSurvival(level || 1);
    return buildBrawl();
  }

  function spawnPoints(name) {
    if (name === "classic") {
      return [
        { x: 16, y: 16 },
        { x: GameConfig.LOGICAL_WIDTH / 2, y: 16 },
        { x: GameConfig.LOGICAL_WIDTH - 16, y: 16 }
      ];
    }
    if (name === "survival") {
      return [
        { x: 48, y: 48 },
        { x: GameConfig.LOGICAL_WIDTH - 48, y: 48 },
        { x: 48, y: GameConfig.LOGICAL_HEIGHT - 48 },
        { x: GameConfig.LOGICAL_WIDTH - 48, y: GameConfig.LOGICAL_HEIGHT - 48 }
      ];
    }
    return {
      blue: [
        { x: 112, y: 288 },
        { x: 160, y: 224 },
        { x: 160, y: 368 }
      ],
      red: [
        { x: GameConfig.LOGICAL_WIDTH - 112, y: 288 },
        { x: GameConfig.LOGICAL_WIDTH - 160, y: 224 },
        { x: GameConfig.LOGICAL_WIDTH - 160, y: 368 }
      ]
    };
  }

  return { build, spawnPoints };
})();
