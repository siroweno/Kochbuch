import { setVisible } from './view-helpers.js';

const MIRAGE_OVERLAY_DURATION = 3500;

export function createAuthShellController(deps) {
  const { state, config, dom, loadingController } = deps;

  function getMirageOverlay() {
    return document.getElementById('mirageOverlay');
  }

  let mirageTransitionActive = false;

  function showMirageOverlay() {
    const overlay = getMirageOverlay();
    if (!overlay) return;
    mirageTransitionActive = true;
    overlay.style.display = 'flex';
    overlay.classList.add('visible');
    overlay.classList.remove('fading');
  }

  function hideMirageOverlay() {
    const overlay = getMirageOverlay();
    if (!overlay) return;
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        overlay.style.display = 'none';
        overlay.classList.remove('visible', 'fading');
        resolve();
      };
      overlay.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 1000);
      overlay.classList.add('fading');
    });
  }

  async function runMirageTransition(loadDataFn) {
    showMirageOverlay();

    const [result] = await Promise.all([
      loadDataFn(),
      new Promise((resolve) => setTimeout(resolve, MIRAGE_OVERLAY_DURATION)),
    ]);

    window.scrollTo(0, 0);
    await hideMirageOverlay();
    mirageTransitionActive = false;
    return result;
  }

  function applyRoleUi(canAdmin) {
    document.querySelectorAll('[data-admin-only]').forEach((element) => {
      element.classList.toggle('admin-hidden', !canAdmin);
    });
  }

  function renderAuthShell(snapshot) {
    state.latestAuthSnapshot = snapshot;

    dom.authBar.classList.toggle('visible', snapshot.accessState === 'signed_in' || snapshot.accessState === 'no_access');
    dom.authBarName.textContent = snapshot.sessionUser?.email || 'Nicht angemeldet';
    dom.authBarMeta.textContent = snapshot.profile
      ? `${snapshot.profile.role === 'admin' ? 'Admin' : 'Reader'} · ${config.backend === 'browser-test' ? 'Browser-Test' : 'Supabase'}`
      : config.backend === 'browser-test' ? 'Browser-Test' : 'Supabase';
    const userMenuName = document.getElementById('userMenuName');
    const userMenuMeta = document.getElementById('userMenuMeta');
    if (userMenuName) userMenuName.textContent = dom.authBarName.textContent;
    if (userMenuMeta) userMenuMeta.textContent = dom.authBarMeta.textContent;
    dom.loginMessage.textContent = snapshot.message || '';
    dom.accessMessage.textContent = snapshot.message || 'Dein Profil konnte gerade nicht geladen werden.';
    dom.loginIntro.textContent = config.backend === 'browser-test'
      ? 'Browser-Test-Modus: Gib eine beliebige Test-E-Mail ein. admin@kochbuch.local wird als Admin angemeldet, alle anderen als Reader.'
      : 'Melde dich mit Google an, um dein persönliches Kochbuch mit Favoriten und Wochenplan zu öffnen.';
    dom.authHint.textContent = config.backend === 'browser-test'
      ? 'Dieser Test-Login ist nur lokal für Playwright und die Entwicklung sichtbar.'
      : 'Google ist der einzige sichtbare Login-Weg. Nach dem ersten Login bleibt deine Session auch auf mehreren Geräten parallel nutzbar.';

    setVisible(dom.googleLoginActions, config.backend !== 'browser-test');
    setVisible(dom.browserTestLoginForm, config.backend === 'browser-test');
    // Login-Panel: animierter Übergang beim Einloggen
    if (snapshot.accessState !== 'signed_out' && dom.loginPanel.classList.contains('visible')) {
      // Statt sofort: animierte Buchseiten-Wende
      dom.loginPanel.classList.add('closing');
      let loginCleaned = false;
      const loginCleanup = () => {
        if (loginCleaned) return;
        loginCleaned = true;
        dom.loginPanel.classList.remove('visible', 'closing');
        dom.loginPanel.style.display = 'none';
      };
      dom.loginPanel.addEventListener('animationend', loginCleanup, { once: true });
      setTimeout(loginCleanup, 600);
    } else {
      setVisible(dom.loginPanel, snapshot.accessState === 'signed_out');
    }
    loadingController.syncLoadingPanel(snapshot);
    setVisible(dom.accessPanel, snapshot.accessState === 'no_access');
    setVisible(dom.configPanel, snapshot.accessState === 'config_missing');
    // App-Shell: sofort sichtbar machen (Overlay verdeckt es während des Ladens)
    if (snapshot.accessState === 'signed_in') {
      dom.appShell.classList.remove('app-shell-hidden', 'app-shell-opening');
    } else {
      dom.appShell.classList.toggle('app-shell-hidden', snapshot.accessState !== 'signed_in');
    }
    applyRoleUi(snapshot.canAdmin);
  }

  function isMirageTransitionActive() {
    return mirageTransitionActive;
  }

  return { renderAuthShell, applyRoleUi, runMirageTransition, showMirageOverlay, hideMirageOverlay, isMirageTransitionActive };
}
