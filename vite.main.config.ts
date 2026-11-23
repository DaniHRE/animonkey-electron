import { defineConfig, loadEnv } from 'vite';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const desktopApiUrl = env.VITE_DESKTOP_API_URL?.trim() ?? '';
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

  if (mode === 'production') {
    let validDesktopApiUrl = false;
    try {
      const url = new URL(desktopApiUrl);
      validDesktopApiUrl =
        url.protocol === 'https:' && url.pathname.endsWith('/desktop-api');
    } catch {
      // The build error below reports missing or malformed public config.
    }

    if (!validDesktopApiUrl || !supabasePublishableKey) {
      throw new Error(
        'Packaged builds require VITE_DESKTOP_API_URL (an HTTPS /desktop-api endpoint) and VITE_SUPABASE_PUBLISHABLE_KEY. Provide both public values in the build environment.',
      );
    }
  }

  return {
    define: {
      __DESKTOP_API_URL__: JSON.stringify(desktopApiUrl),
      __SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(supabasePublishableKey),
    },
  };
});
