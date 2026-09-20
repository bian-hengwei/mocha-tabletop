import {describe, expect, it} from 'vitest';
import {migrateLegacyStorage} from '../src/storage';

function storage(values: Record<string, string>): Storage {
  const data = new Map(Object.entries(values));
  return {
    get length() {return data.size;},
    key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => {data.set(key, value);},
    removeItem: key => {data.delete(key);},
    clear: () => data.clear(),
  };
}
describe('Mocha storage migration', () => {
  it('preserves the profile, authentication token and every room checkpoint', () => {
    const local = storage({'tt-profile': 'profile', 'tt-network-token': 'token'});
    const session = storage({'tt-room-session': 'session', 'tt-host-ABC234': 'room1', 'tt-host-XYZ567': 'room2', unrelated: 'keep'});
    migrateLegacyStorage(local, session);
    expect(local.getItem('mocha-profile')).toBe('profile');
    expect(local.getItem('mocha-network-token')).toBe('token');
    expect(session.getItem('mocha-room-session')).toBe('session');
    expect(session.getItem('mocha-host-ABC234')).toBe('room1');
    expect(session.getItem('mocha-host-XYZ567')).toBe('room2');
    expect(session.getItem('unrelated')).toBe('keep');
    expect(local.getItem('tt-profile')).toBeNull();
    expect(session.getItem('tt-host-XYZ567')).toBeNull();
  });
  it('is idempotent and does not overwrite newer data', () => {
    const local = storage({'tt-profile': 'old', 'mocha-profile': 'new'});
    const session = storage({});
    migrateLegacyStorage(local, session);
    migrateLegacyStorage(local, session);
    expect(local.getItem('mocha-profile')).toBe('new');
    expect(local.length).toBe(1);
  });
  it('retains the old value if writing the new key fails', () => {
    const local = storage({'tt-profile': 'profile'});
    local.setItem = () => {throw new Error('quota');};
    expect(() => migrateLegacyStorage(local, storage({}))).toThrow('quota');
    expect(local.getItem('tt-profile')).toBe('profile');
  });
});
