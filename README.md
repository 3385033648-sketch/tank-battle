<div align="center">

<img src="assets/banner.svg" alt="钢铁前线 Iron Frontier" width="100%"/>

# 钢铁前线 · Iron Frontier

**纯前端 HTML5 坦克大战 · 零依赖 · 打开即玩**

[![在线试玩](https://img.shields.io/badge/立即试玩-GitHub_Pages-2ea44f?style=for-the-badge)](https://3385033648-sketch.github.io/tank-battle/)
[![GitHub](https://img.shields.io/badge/仓库-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/3385033648-sketch/tank-battle)

`WASD` 移动 · `空格` 射击 · 无需安装 · 无需登录

</div>

---

## 🎮 三种游戏模式

| 模式 | 玩法 | 特色 |
|------|------|------|
| **经典战役** | 守卫基地，逐关推进，每关 18 辆敌坦 | 4 种敌坦类型、6 种道具、第 10 关 Boss 战 |
| **极限生存** | 无尽波次，敌强我弱，5 条命极限抗压 | 空投补给、地狱模式、波次奖励 |
| **乱斗竞技** | 3v3 团队对抗，180 秒决胜负 | AI 性格系统（激进/狙击/游击）、连击计分 |

## ⚔️ 游戏系统

- **🛡️ 12 款皮肤**：普通 → 稀有 → 史诗 → 传说四级稀有度，每款带专属配色、炮管样式与特效（粒子拖尾、光环、全屏爆炸），并有速度、护甲、火力、金币收益等属性加成
- **💰 金币经济**：对局胜利/失败均给金币，配合每日签到、每日任务、成就、神秘宝箱、周末双倍收益
- **📅 每日签到**：7 天循环签到，第 7 天送史诗皮肤，全勤额外送传说抽奖券
- **🎁 福利码系统**：主界面「福利兑换」输入福利码即可领奖，防重复、可配置
- **☁️ 云存档**：Supabase 账户系统，跨设备同步金币/皮肤/进度（未配置自动降级为 LocalStorage 离线模式）

## 🎁 浪尖儿社区专属福利

> **福利码：`langjianer666`**
>
> 在游戏主界面点击「福利兑换」，输入 `langjianer666`（大小写不限），即可**免费领取「黑曜石」+「幽灵坦克」两款史诗皮肤**！
>
> 每个存档限领一次，领取后自动进入车库。

## 🕹️ 操作说明

| 操作 | 键盘 | 触屏 |
|------|------|------|
| 移动 | `W A S D` / 方向键 | 左下角虚拟摇杆 |
| 射击 | `空格`（可连发） | 右下角开火按钮 |
| 暂停 | `P` / `Esc` | 右上角暂停按钮 |
| 返回菜单 | `Q` | — |

## 🚀 本地运行

```bash
# 方式一：直接双击 index.html（Chrome / Edge / Firefox 最新版）

# 方式二：本地服务器（推荐）
./start.sh                  # macOS / Linux，默认 8000 端口
powershell -File server.ps1 # Windows
# 浏览器打开 http://localhost:8000
```

## 🛠️ 技术栈

- **HTML5 Canvas 2D** 渲染，逻辑分辨率 960 × 640，自适应桌面/移动端
- **原生 JavaScript**，零框架、零构建步骤、无外部资源
- **Web Audio API** 实时合成全部音效与背景音乐
- **LocalStorage + Supabase** 双层存档，断网也能玩
- 目标 **60fps**，针对低端移动设备做了粒子与 AI 规模控制

## 📁 项目结构

```text
tank-battle/
├── index.html          # 页面结构与画布
├── style.css           # 界面样式与自适应布局
├── config.js           # 集中式游戏平衡配置
├── assets/banner.svg   # README 封面图
├── js/                 # 游戏核心逻辑（14 个模块）
│   ├── main.js         # 入口
│   ├── game.js         # 主循环、碰撞、道具、UI
│   ├── modes.js        # 三种游戏模式
│   ├── ai.js           # 敌人 AI 性格
│   ├── economy.js      # 金币/皮肤/签到/任务/成就
│   └── ...
├── src/systems/        # 账户、云同步、福利码
└── .github/workflows/  # 自动部署工作流
```

## 🤖 自动部署

仓库内置 GitHub Actions 工作流（`.github/workflows/deploy-pages.yml`）：

- **任何代码推送到 `main` 分支，自动构建并部署到 GitHub Pages**
- 在线地址：https://3385033648-sketch.github.io/tank-battle/
- 也可在 Actions 页面手动触发「workflow_dispatch」重新部署

## 📜 更新日志

### v1.0.0 — 2026-08-26
- 🎉 上线 GitHub Pages，接入自动部署工作流
- 🐛 修复卡墙、乱斗人数错误、性能卡顿问题
- 🎁 新增福利码系统（浪尖儿社区专属）
- ☁️ 新增 Supabase 云存档（离线可降级）
- 🎨 新增 README 封面图

---

<div align="center">

**钢铁前线 · Iron Frontier** — 纯前端，零依赖，打开即玩

[立即试玩](https://3385033648-sketch.github.io/tank-battle/) · [GitHub 仓库](https://github.com/3385033648-sketch/tank-battle)

</div>
