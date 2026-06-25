import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('pwa-install-dismissed')) return;

    function handler(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  async function install() {
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') setDeferredPrompt(null);
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', '1');
  }

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 1000,
      background: 'var(--color-surface-raised)', border: '1px solid var(--color-primary)',
      borderRadius: 'var(--radius-md)', padding: 16,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Install Pocket Office</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Add to your home screen for the full app experience
        </div>
      </div>
      <button className="btn btn-primary" onClick={install} style={{ flexShrink: 0 }}>Install</button>
      <button onClick={dismiss} style={{
        background: 'none', border: 'none', color: 'var(--color-text-muted)',
        fontSize: 20, cursor: 'pointer', padding: 4,
      }}>×</button>
    </div>
  );
}
