/**
 * 全局配置：逻辑分辨率、坦克属性、AI 性格、道具与模式参数。
 * LocalStorage 设计：
 *   steel_front_save_v1    最高分/进度/设置（旧存档自动补默认字段）
 *   steel_front_coins_v1   金币独立存档 { coins: 0 }
 *   steel_front_profile_v1 皮肤/碎片/签到/任务/成就/宝箱存档
 */
const GameConfig = Object.freeze({
  LOGICAL_WIDTH: 960,
  LOGICAL_HEIGHT: 640,
  TILE_SIZE: 32,
  STORAGE_KEY: "steel_front_save_v1",
  COIN_KEY: "steel_front_coins_v1",
  PROFILE_KEY: "steel_front_profile_v1",

  PLAYER: {
    size: 28,
    speed: 138,
    fireInterval: 0.32,
    bulletSpeed: 380,
    bulletDamage: 1,
    color: "#5aa7ff",
    barrelColor: "#cfe6ff",
    maxFirepower: 3
  },

  ENEMY_TYPES: {
    normal: {
      label: "普通型",
      color: "#9aa3ad",
      accent: "#cdd4db",
      hp: 1,
      speed: 58,
      score: 100,
      fireInterval: 1.7,
      bulletSpeed: 270,
      spread: 1
    },
    fast: {
      label: "快速型",
      color: "#37b26c",
      accent: "#8ce8b0",
      hp: 1,
      speed: 116,
      score: 200,
      fireInterval: 1.5,
      bulletSpeed: 310,
      spread: 1
    },
    armored: {
      label: "装甲型",
      color: "#e0b12c",
      accent: "#ffe08a",
      hp: 4,
      speed: 50,
      score: 400,
      fireInterval: 1.9,
      bulletSpeed: 285,
      spread: 1
    },
    heavy: {
      label: "重型",
      color: "#d94f4f",
      accent: "#ffb0a0",
      hp: 10,
      speed: 42,
      score: 800,
      fireInterval: 2.2,
      bulletSpeed: 300,
      spread: 3
    }
  },

  AI_PROFILES: {
    aggressive: {
      label: "激进型",
      color: "#e05555",
      accent: "#ffb0a0",
      hp: 4,
      speed: 100,
      score: 300,
      fireInterval: 0.62,
      bulletSpeed: 340,
      spread: 1,
      preferRange: 9999
    },
    sniper: {
      label: "狙击型",
      color: "#4f86e8",
      accent: "#bcd6ff",
      hp: 3,
      speed: 72,
      score: 300,
      fireInterval: 1.05,
      bulletSpeed: 450,
      spread: 1,
      preferRange: 280
    },
    guerrilla: {
      label: "游击型",
      color: "#e8843a",
      accent: "#ffcf9a",
      hp: 3,
      speed: 132,
      score: 300,
      fireInterval: 0.78,
      bulletSpeed: 340,
      spread: 1,
      preferRange: 130
    },
    team: {
      label: "团队型",
      color: "#3fb7a8",
      accent: "#a7f0e4",
      hp: 5,
      speed: 92,
      score: 300,
      fireInterval: 0.66,
      bulletSpeed: 350,
      spread: 1,
      preferRange: 170
    }
  },

  POWERUPS: {
    star:   { label: "火力升级", color: "#ffd166" },
    tank:   { label: "额外生命", color: "#42d392" },
    helmet: { label: "无敌头盔", color: "#6aa9ff" },
    bomb:   { label: "全屏清敌", color: "#ff5d5d" },
    shovel: { label: "钢铁壁垒", color: "#c7d0d8" },
    clock:  { label: "时间冻结", color: "#7fd8ff" }
  },

  SUPABASE_CONFIG: {
    url: "",
    anonKey: ""
  },

  REWARD_CODE_CONFIG: {
    codes: [
      {
        code: "langjianer666",
        name: "浪尖儿社区专属福利",
        rewards: ["obsidian", "ghost_tank"],
        claimedKey: "tank_reward_langjianer666",
        description: "免费领取黑曜石皮肤 + 幽灵坦克皮肤"
      }
    ]
  },

  MODES: {
    classic: {
      initialLives: 3,
      enemiesPerLevel: 18,
      maxActive: 4,
      respawnDelay: 2.0
    },
    survival: {
      initialHp: 5,
      waveBase: 3,
      maxActive: 7
    },
    brawl: {
      duration: 180,
      teamSize: 3,
      respawnDelay: 3.0
    }
  }
});
