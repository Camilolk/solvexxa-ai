import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  let refreshedForWorkerUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshedForWorkerUpdate) return;
    refreshedForWorkerUpdate = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
      registration.update().catch(() => {});
    }).catch(() => {
      console.warn('No se pudo registrar el service worker.');
    });
  });
}
