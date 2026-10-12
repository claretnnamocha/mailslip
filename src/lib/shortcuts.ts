export const SHORTCUTS_STORAGE_KEY = "mailslip-shortcuts";
const SHORTCUTS_EVENT = "mailslip-shortcuts-change";

/** Off unless the person has turned them on in settings. */
export function readShortcutsEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SHORTCUTS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeShortcutsEnabled(enabled: boolean) {
  window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event(SHORTCUTS_EVENT));
}

export function subscribeShortcuts(onChange: () => void) {
  window.addEventListener(SHORTCUTS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SHORTCUTS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
