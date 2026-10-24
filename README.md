# 跳跃小游戏（Phaser 3 + Vite）

收集星星，躲开炸弹。每收集完一轮星星会多一颗炸弹。

## 操作

- 电脑：方向键 / A D 移动，空格 / 上键 / W 跳跃
- 手机：按住屏幕左半边 / 右半边移动，点屏幕上半部分跳跃

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
index.html               页面入口
src/main.js              游戏配置（尺寸、物理引擎、场景列表）
src/scenes/GameScene.js  游戏主场景（玩法逻辑都在这里）
.devcontainer/           Codespaces 环境配置
```

## 发布

`npm run build` 会生成 `dist/` 目录，可以直接部署到 GitHub Pages、Vercel 等静态托管服务。
