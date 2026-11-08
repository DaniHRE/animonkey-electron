import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const endpoint =
    process.env.VITE_ANIVEXA_API_URL ||
    env.VITE_ANIVEXA_API_URL ||
    (mode === 'development' ? 'http://localhost:4000' : '');
  const parsedEndpoint = endpoint ? new URL(endpoint) : null;
  const allowLocalHttpForTests =
    process.env.VITE_ALLOW_LOCAL_HTTP_API_FOR_TESTS === 'true' ||
    env.VITE_ALLOW_LOCAL_HTTP_API_FOR_TESTS === 'true';
  if (parsedEndpoint?.username || parsedEndpoint?.password) {
    throw new Error('A URL do Anivexa não pode conter credenciais.');
  }
  const isLocalHttp =
    parsedEndpoint?.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(parsedEndpoint.hostname);
  if (
    parsedEndpoint &&
    parsedEndpoint.protocol !== 'https:' &&
    !((mode === 'development' || allowLocalHttpForTests) && isLocalHttp)
  ) {
    throw new Error(
      'O endpoint Anivexa deve usar HTTPS; HTTP é permitido apenas para localhost em desenvolvimento.',
    );
  }
  const origin = parsedEndpoint?.origin ?? "'none'";
  return {
    base: './',
    worker: { format: 'es' },
    plugins: [
      tailwindcss(),
      {
        name: 'animonkey-csp',
        transformIndexHtml(html) {
          return html.replace('__ANIVEXA_ORIGIN__', origin);
        },
      },
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  };
});
