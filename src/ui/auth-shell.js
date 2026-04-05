import { setVisible } from './view-helpers.js';

export function createAuthShellController(deps) {
  const { state, config, dom, modalController, deleteDialogController, clearPlanDialogController, loadingController } = deps;

  function syncBodyScrollLock() {
    const shouldLock = modalController.isOpen() || deleteDialogController.isOpen() || clearPlanDialogController.isOpen();
    document.body.style.overflow = shouldLock ? 'hidden' : '';
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
      dom.loginPanel.addEventListener('animationend', () => {
        dom.loginPanel.classList.remove('visible', 'closing');
        dom.loginPanel.style.display = 'none';
      }, { once: true });
    } else {
      setVisible(dom.loginPanel, snapshot.accessState === 'signed_out');
    }
    loadingController.syncLoadingPanel(snapshot);
    setVisible(dom.accessPanel, snapshot.accessState === 'no_access');
    setVisible(dom.configPanel, snapshot.accessState === 'config_missing');
    // App-Shell: animiertes Aufdecken beim Einloggen
    if (snapshot.accessState === 'signed_in' && dom.appShell.classList.contains('app-shell-hidden')) {
      dom.appShell.classList.remove('app-shell-hidden');
      dom.appShell.classList.add('app-shell-opening');
      dom.appShell.addEventListener('animationend', () => {
        dom.appShell.classList.remove('app-shell-opening');
      }, { once: true });
    } else {
      dom.appShell.classList.toggle('app-shell-hidden', snapshot.accessState !== 'signed_in');
    }
    applyRoleUi(snapshot.canAdmin);
  }

  return { renderAuthShell, applyRoleUi, syncBodyScrollLock };
}
