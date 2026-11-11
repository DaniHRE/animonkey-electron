import { defineConfig, loadEnv } from 'vite';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    define: {
      __DESKTOP_API_URL__: JSON.stringify(env.VITE_DESKTOP_API_URL ?? ''),
      __SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
      ),
    },
  };
});
