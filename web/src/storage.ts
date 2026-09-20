/** Preserve identities and in-progress LAN rooms across the Mocha rebrand. */
export function migrateLegacyStorage(local: Storage, session: Storage) {
  const move = (storage: Storage, oldKey: string, newKey: string) => {
    const value = storage.getItem(oldKey);
    if (value === null) return;
    if (storage.getItem(newKey) === null) storage.setItem(newKey, value);
    storage.removeItem(oldKey);
  };
  move(local, 'tt-profile', 'mocha-profile');
  move(local, 'tt-network-token', 'mocha-network-token');
  move(session, 'tt-room-session', 'mocha-room-session');
  const keys = Array.from({length: session.length}, (_, i) => session.key(i));
  for (const key of keys) {
    if (key?.startsWith('tt-host-')) move(session, key, 'mocha-host-' + key.slice(8));
  }
}
