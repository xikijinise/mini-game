import { defineConfig } from 'vite';

// 默认 base=/survivor/；公开 Pages 构建时设 VITE_BASE=/mini-game/
export default defineConfig({
  base: process.env.VITE_BASE || '/survivor/',
});
