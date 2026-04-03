let runtimeConfigPromise = null;

export function loadRuntimeConfig() {
  if (window.__KOCHBUCH_CONFIG__ && typeof window.__KOCHBUCH_CONFIG__ === 'object') {
    return Promise.resolve(window.__KOCHBUCH_CONFIG__);
  }

  if (runtimeConfigPromise) {
    return runtimeConfigPromise;
  }

  runtimeConfigPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}runtime-config.js`;
    script.async = false;
    script.onload = () => resolve(window.__KOCHBUCH_CONFIG__ || {});
    script.onerror = () => reject(new Error('Runtime-Konfiguration konnte nicht geladen werden.'));
    document.head.appendChild(script);
  });

  return runtimeConfigPromise;
}
