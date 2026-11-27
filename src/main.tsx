import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Tier 1 Google Maps Platform Demo Key quota & auth defense (module root before render)
declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

window.gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  originalConsoleError.apply(console, args);
  const message = args.map((item) => String(item)).join(' ');
  if (message.includes('OverQuotaMapError') || message.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
