import React from 'react';
import ReactDOM from 'react-dom/client';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Load the app lazily so a startup failure (e.g. missing environment variables on the host)
// shows a readable message instead of a blank page.
import('./App.tsx')
  .then(({ App }) => {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch((error: Error) => {
    console.error('App failed to start:', error);
    rootElement.innerHTML =
      '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 24px;color:#1e293b">' +
      '<h1 style="font-size:20px;margin:0 0 8px">Autorank AI could not start</h1>' +
      '<p style="margin:0 0 12px;color:#475569">The app is not configured correctly. If you are the site owner, check the environment variables in your hosting settings and redeploy.</p>' +
      '<pre style="background:#f1f5f9;padding:12px;border-radius:8px;white-space:pre-wrap;font-size:12px"></pre></div>';
    rootElement.querySelector('pre')!.textContent = error.message;
  });
