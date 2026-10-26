# 火柴人幸存者（Phaser 3 + Vite）


## 预览地址


- GitHub Pages：https://xikijinise.github.io/mini-game/ （Actions 构建时 `VITE_BASE=/mini-game/`）

割草类肉鸽小游戏：你只管上下左右走位，武器会自动攻击。打死动物会掉经验晶体，升级时三选一强化，坚持得越久怪越多越强。

## 操作

- 移动：WASD 或方向键
- 升级选择：鼠标点击卡片

## 玩法说明

**经验晶体颜色 = 怪物大小**

| 晶体 | 来自 | 经验 |
|---|---|---|
| 🔷 蓝色 | 小怪：老鼠、兔子、青蛙 | 1 |
| 🟢 绿色 | 中怪：狐狸、狼 | 4 |
| 🟣 紫色 | 大怪：野猪、熊、老虎 | 12 |
| 🟡 金色 | Boss：大象（每 3 分钟一只） | 60 |

**武器**（每种最高 5 级）：飞刀（开局自带）、火球环绕、落雷、光环、冰锥、连射箭

**被动**（每种最高 5 级）：跑鞋（移速）、强心（生命）、磁铁（拾取范围）、力量（伤害）、急速（冷却）、再生（回血）

## 本地运行

```bash
npm install
npm run dev
```

然后打开终端里显示的地址（默认 http://localhost:5173）。

## 在 GitHub Codespaces 里运行

1. 在仓库页面点 **Code → Codespaces → Create codespace on main**
2. 等环境创建完成（会自动执行 `npm install`）
3. 在终端运行 `npm run dev`，会自动弹出游戏预览页面

用完记得在 https://github.com/codespaces 停止环境，避免消耗免费额度。

## 目录结构

```
src/main.js              游戏配置（画面尺寸、物理引擎）
src/scenes/GameScene.js  主场景：移动、刷怪、武器、经验、升级、界面
src/data/enemies.js      怪物和经验晶体的数值 ← 想调难度改这里
src/data/weapons.js      武器每一级的数值
src/data/passives.js     被动强化
src/ui/levelUp.js        升级三选一面板
src/textures.js          所有贴图（火柴人、晶体、武器、动物 emoji）
.devcontainer/           Codespaces 环境配置
```

## 调试小技巧

开发模式下可以在浏览器控制台里直接操作游戏，例如：

```js
game.scene.keys.GameScene.gainXp(50)          // 送 50 经验
game.scene.keys.GameScene.stats.hp = 9999     // 无敌
```

## 发布

`npm run build` 会生成 `dist/` 目录，可以直接部署到 GitHub Pages、Vercel 等静态托管服务。
