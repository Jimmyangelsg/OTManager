import { useEffect } from 'react';

/**
 * useKeyboardShortcuts — wires up window keydown shortcuts but suppresses them
 * when the user is typing in an input/textarea/contenteditable.
 *
 * `shortcuts` is an array of { key, ctrlOrMeta?, handler }.
 * `enabled` (default true) toggles all shortcuts off.
 * `passthroughKeys` lists keys (lowercased) that should fire EVEN while typing
 * (e.g. 'escape').
 */
export default function useKeyboardShortcuts(shortcuts, { enabled = true, passthroughKeys = ['escape'] } = {}) {
  useEffect(() => {
    if (!enabled || !shortcuts || shortcuts.length === 0) return undefined;

    const onKey = (e) => {
      const target = e.target;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      const key = (e.key || '').toLowerCase();
      const allowThrough = passthroughKeys.includes(key);

      if (isTyping && !allowThrough) return;

      for (const s of shortcuts) {
        const matchKey = (s.key || '').toLowerCase() === key;
        const matchCtrl = s.ctrlOrMeta ? (e.metaKey || e.ctrlKey) : true;
        if (matchKey && matchCtrl) {
          e.preventDefault();
          s.handler(e);
          return;
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcuts, enabled, passthroughKeys]);
}
