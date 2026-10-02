import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // BACKEND_URL (variable de entorno o .env) cambia el destino del proxy de desarrollo.
  const env = loadEnv(mode, '.', '');
  const target = env.BACKEND_URL || 'http://localhost:3000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/socket.io': { target, changeOrigin: true, ws: true },
      },
    },
  };
});
