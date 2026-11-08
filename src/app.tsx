import { createRoot } from 'react-dom/client';
import { AppRoot } from '@/app-root';

const rootElement = document.getElementById('app');
if (!rootElement) throw new Error('App root element was not found.');

createRoot(rootElement).render(<AppRoot />);
