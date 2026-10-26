# 火柴人幸存者（Phaser 3 + Vite）

## 预览地址

- GitHub Pages：https://xikijinise.github.io/mini-game/ （构建时设 `VITE_BASE=/mini-game/`）

割草类肉鸽小游戏：你只管走位，武器自动攻击。打死动物掉经验晶体，升级时 **5 选 2**。无尽模式，只有死亡结束；物种越杀越强，Boss 按时间表常驻登场。

## 操作

- 移动：WASD 或方向键
- 暂停：Esc
- 升级：鼠标点选，或按 `1`–`5` 选满 2 项

## 玩法说明

**经验晶体颜色 = 怪物大小**

| 晶体 | 来自 | 经验 |
|---|---|---|
| 🔷 蓝色 | 小怪：老鼠、兔子、青蛙 | 1 |
| 🟢 绿色 | 中怪：狐狸、狼 | 4 |
| 🟣 紫色 | 大怪：野猪、熊、老虎 | 12 |
| 🟡 金色 | Boss | 60 |

**刷怪与星级**

- 开局老鼠、兔子；其余可按时间表出场，也可在某物种到 **★1** 时按顺序再解锁后面 2 种
- 同物种击杀升星：血/伤/速全局抬升，并有分物种额外加成；体型随星级变大
- 普通怪另吃时间成长（约 t/200）

**武器**（共 10 种；表内最高 10 级；满级后仍可选，叠伤害与体积/范围）：飞刀（开局自带）、火球环绕、落雷、光环、冰锥、连射箭、回旋镖、剑气、地刺（脚下预警后冒岩刺 AoE）、链球（绕身远距离慢转重击）

**被动**（无升级上限）：跑鞋、强心、磁铁、力量、急速、再生

**数值卡**（升级池常驻，无上限）：攻击 +1、防御 +1、移速、生命、拾取、冷却等

**Boss**（常驻，打死才走；也吃时间成长）

| 时间 | Boss |
|---|---|
| 2:30 | 野猪王 |
| 4:00 | 狼王 |
| 5:30 | 象王 |
| 之后每 90s | 按上表循环，逐轮加强 |

## 本地运行

```bash
npm install
npm run dev
```

打开终端里显示的地址（默认 http://localhost:5173）。默认 `base` 为 `/`（Vercel 根路径部署）；公开 Pages 构建请设 `VITE_BASE=/mini-game/`。

## 在 GitHub Codespaces 里运行

1. 仓库页 **Code → Codespaces → Create codespace on main**
2. 环境就绪后（会自动 `npm install`）在终端跑 `npm run dev`

用完在 https://github.com/codespaces 停掉环境，避免耗额度。

## 目录结构

```
src/main.js                 游戏配置
src/scenes/GameScene.js     主场景：移动、刷怪、武器、Boss、升级
src/data/enemies.js         普通怪与晶体
src/data/bosses.js          常驻 Boss 时间表与数值
src/data/killScale.js       物种星级、解锁、分物种加成
src/data/weapons.js         武器等级表
src/data/passives.js        被动
src/data/statBoosts.js      升级数值卡与武器超限倍率
src/data/waves.js           刷怪节奏
src/ui/levelUp.js           升级 5 选 2 面板
src/textures.js / systems/  贴图与障碍
public/assets/              动物 / 武器 / 障碍 PNG
.devcontainer/              Codespaces
```

## 调试

开发模式可在控制台操作，例如：

```js
game.scene.keys.GameScene.gainXp(50)
game.scene.keys.GameScene.stats.hp = 9999
```

开局加速手验：URL 加 `?t=330`（秒）、`?cheat=1`。

## 发布

`npm run build` 生成 `dist/`，可部署到 GitHub Pages 等静态托管。
