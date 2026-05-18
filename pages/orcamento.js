/* ===== CORREÇÃO: ABAS ESCURAS ===== */
/* Adicione isso no FINAL do globals.css */

.nav-btn, .tab {
  background: transparent !important;
  color: var(--text2) !important;
  border: .5px solid var(--border2) !important;
}

.nav-btn:hover, .tab:hover {
  background: var(--bg2) !important;
  color: var(--text) !important;
}

.nav-btn.active, .tab.active {
  background: var(--bg3) !important;
  color: var(--text) !important;
  border-color: var(--text) !important;
}
