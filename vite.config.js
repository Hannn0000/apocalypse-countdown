import { defineConfig } from 'vite';

// base: './' 让打包后的资源使用相对路径，可直接部署到 GitHub Pages 的子路径
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2019',
    chunkSizeWarningLimit: 900,
  },
  server: { host: true },
});
