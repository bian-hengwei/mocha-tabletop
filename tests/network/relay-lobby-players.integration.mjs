import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';

// Uses real RoomClient WebSockets and, for LAN game traffic, real WebRTC channels.
// Run against an isolated Worker/Vite pair with current dist assets built first.
const base = process.env.BASE_URL || process.env.TEST_FRONTEND || 'http://127.0.0.1:5174';
const api = process.env.TEST_API_BASE || base;
const modes = (process.env.TEST_ROOM_MODES || 'cloud,lan').split(',');
assert(modes.every(mode => ['cloud', 'lan'].includes(mode)), 'Unknown room mode');
assert.equal((await fetch(`${api}/api/health`)).ok, true, 'Worker health');
const browser = await chromium.launch();

async function player(name) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/manifest-mocha.webmanifest`);
  await page.evaluate(async name => {
    const {RoomClient} = await import('/src/net/client.ts');
    window.client = new RoomClient();
    window.commandErrors = [];
    client.subscribe(state => { if (state.error) commandErrors.push(state.error); });
    window.profile = {id: crypto.randomUUID(), name, avatar: '🦊'};
  }, name);
  return page;
}
async function room(page) { return page.evaluate(() => client.state.room); }
async function settled(page) {
  await page.waitForFunction(() => client.state.room && !client.state.error && client.state.transport === client.state.mode);
}
async function create(host, mode, relayMode, relayPlayers) {
  await host.evaluate(({mode, relayMode, relayPlayers}) => client.create(profile, 'drawrelay', mode,
    {relayMode, relaySeconds: 0, language: 'en', ...(relayPlayers === undefined ? {} : {relayPlayers})}), {mode, relayMode, relayPlayers});
  await host.waitForFunction(() => client.state.room || client.state.error);
  assert.equal(await host.evaluate(() => client.state.error), undefined);
  await settled(host);
  return host.evaluate(() => ({code: client.state.room.code, invite: new URL(client.state.inviteURL).hash.slice(1).split('=')[1]}));
}
async function join(page, invitation, spectator = false) {
  await page.evaluate(({invitation, spectator}) => client.join(profile, invitation.code, invitation.invite, spectator), {invitation, spectator});
  await settled(page);
}
async function control(page, method, args = []) {
  const revision = (await room(page)).revision;
  await page.evaluate(({method, args}) => { client.clearError(); window.commandErrors = []; client[method](...args); }, {method, args});
  await page.waitForFunction(revision => client.state.error || client.state.room?.revision > revision, revision);
  assert.equal(await page.evaluate(() => client.state.error), undefined, `${method} ${JSON.stringify(args)}`);
}
async function rejected(page, method, args, pattern) {
  await page.evaluate(({method, args}) => { client.clearError(); window.commandErrors = []; client[method](...args); }, {method, args});
  // LAN snapshots can arrive immediately after the WebSocket rejection and clear
  // its visible error. Observe the delivered rejection without racing the snapshot.
  await page.waitForFunction(() => window.commandErrors.length > 0);
  assert.match(await page.evaluate(() => commandErrors[0]), pattern, method);
  await page.evaluate(() => client.clearError());
}
async function target(host, pages, count) {
  const options = (await room(host)).options;
  await control(host, 'selectGame', ['drawrelay', {...options, relayPlayers: count}]);
  await Promise.all(pages.map(page => page.waitForFunction(count => client.state.room?.options?.relayPlayers === count, count)));
  const current = await room(host);
  assert(current.players.filter(p => p.id !== current.hostID).every(p => !p.ready), 'target change resets every nonhost ready');
}
async function readyAll(host, pages) {
  for (const page of pages.filter(page => page !== host)) await control(page, 'ready', [true]);
  await host.waitForFunction(() => client.state.room.players.every(p => p.ready));
}
async function reconnect(page, reload = false) {
  if (reload) await page.reload();
  else await page.evaluate(() => client.destroy());
  await page.evaluate(async () => {
    const {RoomClient} = await import('/src/net/client.ts');
    window.client = new RoomClient();
    window.commandErrors = [];
    client.subscribe(state => { if (state.error) commandErrors.push(state.error); });
    await client.connect();
  });
  await settled(page);
}
async function start(host, pages, count, mode, relayMode, invitation) {
  await readyAll(host, pages);
  await control(host, 'start');
  await Promise.all(pages.map(page => page.waitForFunction(() => client.state.view && !client.state.paused && !client.state.error)));
  const started = await room(host);
  assert.equal(started.code, invitation.code);
  assert.equal(started.players.length, count);
  assert.equal(started.mode, mode);
  assert.equal(started.options.relayMode, relayMode);
  assert.equal(new Set(started.players.map(p => p.id)).size, count);
  await rejected(host, 'selectGame', ['drawrelay', {...started.options, relayPlayers: 5}], /请先回到房间/);
  assert.equal((await room(host)).matchID, started.matchID);
  assert.deepEqual((await room(host)).options, started.options);
  // Exercise the authority after start rather than just asserting a lobby snapshot.
  const key = relayMode === 'queue' ? '0:0' : '0';
  await host.evaluate(key => client.action({action: 'draft', values: [key], text: 'Network target proof'}), key);
  await host.waitForFunction(() => client.state.view.board.draft?.text === 'Network target proof');
  if (mode === 'lan') assert.equal(await host.evaluate(() => client.state.transport), 'lan');
}
async function unchanged(host, before) {
  const after = await room(host);
  assert.deepEqual(after.options, before.options);
  assert.deepEqual(after.players.map(p => [p.id, p.ready]), before.players.map(p => [p.id, p.ready]));
  assert.equal(after.code, before.code);
}

try {
  for (const mode of modes) for (const relayMode of ['rounds', 'queue']) {
    const pages = await Promise.all(['Host', 'Guest', 'Third', 'Fourth', 'Observer', 'Extra'].map(player));
    const [host, guest, third, fourth, observer, extra] = pages;
    try {
      const fewer = relayMode === 'rounds';
      const invitation = await create(host, mode, relayMode, fewer ? 6 : 3);
      for (const page of [guest, third]) await join(page, invitation);
      if (fewer) {
        await join(fourth, invitation);
        const ids = (await room(host)).players.map(p => p.id);
        await readyAll(host, [host, guest, third, fourth]);
        await rejected(host, 'start', [], /入座人数与本局人数不一致/);
        await rejected(guest, 'selectGame', ['drawrelay', {...(await room(host)).options, relayPlayers: 4}], /请先回到房间/);
        const before = await room(host);
        for (const bad of [2, 13, 3.5, '4']) {
          await rejected(host, 'selectGame', ['drawrelay', {...before.options, relayPlayers: bad}], /本局人数须为/);
          await unchanged(host, before);
        }
        await target(host, [host, guest, third, fourth], 4);
        assert.deepEqual((await room(host)).players.map(p => p.id), ids);
        const inviteURL = await host.evaluate(() => client.state.inviteURL);
        // Offline seats still count. Only explicit host removal releases one.
        await fourth.evaluate(() => client.destroy());
        await host.waitForFunction(id => client.state.room.players.some(p => p.id === id && !p.connected), ids[3]);
        const reserved = await room(host);
        await rejected(host, 'selectGame', ['drawrelay', {...reserved.options, relayPlayers: 3}], /移除离线玩家|人数/);
        await unchanged(host, reserved);
        await control(host, 'removePlayer', [ids[3]]);
        await target(host, [host, guest, third], 3);
        await target(host, [host, guest, third], 4);
        // The same synthetic identity can use the unchanged invitation again.
        await fourth.evaluate(async () => { const {RoomClient} = await import('/src/net/client.ts'); window.client = new RoomClient();
    window.commandErrors = [];
    client.subscribe(state => { if (state.error) commandErrors.push(state.error); }); });
        await join(fourth, invitation);
        assert.equal(await host.evaluate(() => client.state.inviteURL), inviteURL);
        await reconnect(guest, true);
        assert.equal((await room(guest)).options.relayPlayers, 4);
        assert.equal((await room(guest)).players.find(p => p.id === ids[1]).id, ids[1]);
        await start(host, [host, guest, third, fourth], 4, mode, relayMode, invitation);
      } else {
        // Make a pending request while there is a free seat, then fill that seat.
        await third.evaluate(() => client.setSeat(true));
        await host.waitForFunction(() => client.state.room.players.length === 2);
        await fourth.evaluate(code => client.join(profile, code), invitation.code);
        await host.waitForFunction(() => client.state.room.pending.length === 1);
        const pendingID = await fourth.evaluate(() => profile.id);
        await control(third, 'setSeat', [false]);
        await join(observer, invitation, true);
        await rejected(host, 'approve', [pendingID, true], /满/);
        assert.equal((await room(host)).pending[0].id, pendingID, 'full approval is atomic');
        await rejected(observer, 'setSeat', [false], /满/);
        await rejected(extra, 'join', [await extra.evaluate(() => profile), invitation.code, invitation.invite], /满/);
        assert.equal((await room(host)).players.length, 3);
        await readyAll(host, [host, guest, third]);
        await target(host, [host, guest, third, observer], 4);
        const candidates = await host.evaluate(() => client.discover());
        assert.equal(candidates.find(candidate => candidate.code === invitation.code)?.max, 4, 'directory reflects target');
        await control(host, 'approve', [pendingID, true]);
        await settled(fourth);
        await host.waitForFunction(() => client.state.room.players.length === 4);
        await start(host, [host, guest, third, fourth], 4, mode, relayMode, invitation);
      }
      console.log(`PASS relay lobby ${mode}/${relayMode}: same room target adjustment, authority, readiness, reserved seats/admission and start`);
    } finally {
      await host.evaluate(() => client.leave()).catch(() => {});
      for (const page of pages) await page.context().close();
    }
  }
  for (const mode of modes) {
    const pages = await Promise.all(['LegacyHost', 'LegacyGuest', 'LegacyThird', 'LegacyFourth'].map(player));
    const [host, guest, third, fourth] = pages;
    try {
      // API omission represents an existing room with legacy automatic 3–12 limits.
      const invitation = await create(host, mode, 'rounds');
      assert.equal((await room(host)).options.relayPlayers, undefined);
      for (const page of [guest, third, fourth]) await join(page, invitation);
      const candidates = await host.evaluate(() => client.discover());
      assert.equal(candidates.find(candidate => candidate.code === invitation.code)?.max, 12);
      if (mode === 'lan') {
        await target(host, pages, 4);
        const ids = (await room(host)).players.map(p => p.id);
        await control(host, 'switchToCloud');
        await Promise.all(pages.map(page => page.waitForFunction(() => client.state.mode === 'cloud' && client.state.transport === 'cloud')));
        assert.deepEqual((await room(host)).players.map(p => p.id), ids);
        await reconnect(host, true);
        assert.equal((await room(host)).options.relayPlayers, 4);
        assert.equal((await room(host)).code, invitation.code);
      }
      await start(host, pages, 4, mode === 'lan' ? 'cloud' : mode, 'rounds', invitation);
      console.log(`PASS ${mode}: legacy omission accepts fourth seat${mode === 'lan' ? ', explicit target persists through prestart cloud fallback and host reload' : ' and starts without an exact target'}`);
    } finally {
      await host.evaluate(() => client.leave()).catch(() => {});
      for (const page of pages) await page.context().close();
    }
  }
} finally { await browser.close(); }
