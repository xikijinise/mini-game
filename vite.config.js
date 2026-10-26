import { defineConfig } from 'vite';

// 默认 base=/（Vercel 根路径部署）；GitHub Pages 构建时设 VITE_BASE=/mini-game/
export default defineConfig({
  base: process.env.VITE_BASE || '/',
});
