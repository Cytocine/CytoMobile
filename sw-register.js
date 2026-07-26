/**
 * Registers the service worker and surfaces a lightweight "update ready"
 * banner when a new version of CytoSwing has been fetched in the
 * background, so a long-lived open tab doesn't silently run stale code.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then((registration) => {
        // Check for updates every time the tab regains focus.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update();
        });

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner(registration);
            }
          });
        });
      })
      .catch((err) => console.warn('[CytoSwing] Service worker registration failed:', err));

    // Reload once the new SW takes control (after user accepts the update).
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });

  function showUpdateBanner(registration) {
    const banner = document.createElement('div');
    banner.setAttribute('role', 'status');
    banner.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:16px', 'transform:translateX(-50%)',
      'z-index:99999', 'background:#0d1219', 'border:1px solid rgba(38,166,154,0.4)',
      'color:#e2e8f0', 'font-family:"Space Mono",monospace', 'font-size:11px',
      'padding:10px 14px', 'border-radius:8px', 'display:flex', 'align-items:center',
      'gap:10px', 'box-shadow:0 6px 24px rgba(0,0,0,.4)',
    ].join(';');
    banner.innerHTML = `
      <span>A new version of CytoSwing is ready.</span>
      <button id="cs-sw-reload" style="background:rgba(38,166,154,.15);border:1px solid #26A69A;color:#26A69A;font-family:inherit;font-size:10px;font-weight:700;padding:5px 10px;border-radius:5px;cursor:pointer;">RELOAD</button>
      <button id="cs-sw-dismiss" style="background:none;border:none;color:#64748b;font-family:inherit;font-size:14px;cursor:pointer;padding:0 2px;">✕</button>
    `;
    document.body.appendChild(banner);

    banner.querySelector('#cs-sw-reload').addEventListener('click', () => {
      registration.waiting?.postMessage('SKIP_WAITING');
      banner.remove();
    });
    banner.querySelector('#cs-sw-dismiss').addEventListener('click', () => banner.remove());
  }
})();
