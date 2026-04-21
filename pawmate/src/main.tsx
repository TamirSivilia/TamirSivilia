import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import '@/lib/i18n.ts'; // must import before App to init i18next
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
