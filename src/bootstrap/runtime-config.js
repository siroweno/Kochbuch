let runtimeConfigPromise = null;

function getRuntimeConfigUrl() {
  const viteBaseUrl = typeof import.meta !== 'undefined' ? import.meta.env?.BASE_URL : undefined;
  if (typeof viteBaseUrl === 'string' && viteBaseUrl) {
    return `${viteBaseUrl}runtime-config.js`;
  }

  return new URL('runtime-config.js', document.baseURI).toString();
}

export function loadRuntimeConfig() {
  if (window.__KOCHBUCH_CONFIG__ && typeof window.__KOCHBUCH_CONFIG__ === 'object') {
    return Promise.resolve(window.__KOCHBUCH_CONFIG__);
  }

  if (runtimeConfigPromise) {
    return runtimeConfigPromise;
  }

  runtimeConfigPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = getRuntimeConfigUrl();
    script.async = false;
    script.onload = () => resolve(window.__KOCHBUCH_CONFIG__ || {});
    script.onerror = () => reject(new Error('Runtime-Konfiguration konnte nicht geladen werden.'));
    document.head.appendChild(script);
  });

  return runtimeConfigPromise;
}
