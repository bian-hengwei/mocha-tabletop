import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { avalon } from '../src/core/games/avalon';
import { AvalonBoard } from '../src/ui/AvalonBoard';
import { setLocale, t, type Locale } from '../src/i18n';

const players = Array.from({ length: 10 }, (_, index) => ({ id: `p${index}`, name: `Player ${index}`, avatar: '🦊' }));
beforeAll(() => vi.stubGlobal('document', { documentElement: { lang: '' } }));
afterEach(() => setLocale('zh'));
afterAll(() => vi.unstubAllGlobals());

describe('Avalon public board identity boundary', () => {
    for (const locale of ['zh', 'en'] as Locale[]) {
        it(`${locale}: team membership never reveals the viewer's private role`, () => {
            setLocale(locale);
            const state = avalon.create(players, 19);
            const viewer = players.find(player => state.roles[player.id] === 'merlin')!;
            state.stage = 'approve';
            state.team = [viewer.id];
            const markup = renderToStaticMarkup(createElement(AvalonBoard, {
                view: avalon.view(state, viewer.id), selfID: viewer.id, open: () => {},
            }));
            expect(markup).toContain(t('已入队'));
            expect(markup).not.toContain(t('梅林'));
            expect(markup).not.toContain(t('派西维尔'));
            expect(markup).not.toContain(t('莫甘娜'));
        });

        it(`${locale}: finished seats expose public roles in their accessible names`, () => {
            setLocale(locale);
            const state = avalon.create(players, 19);
            const viewer = players.find(player => state.roles[player.id] === 'merlin')!;
            state.winner = '正义获胜 · 梅林幸存';
            state.publicVotes = { [viewer.id]: false };
            const markup = renderToStaticMarkup(createElement(AvalonBoard, {
                view: avalon.view(state, viewer.id), selfID: viewer.id, open: () => {},
            }));
            expect(markup).toContain(`aria-label="${t('座位')} ${players.indexOf(viewer) + 1} · ${viewer.name} · ${t('梅林')}`);
            expect(markup).not.toContain('vote-mark');
            expect(markup).not.toContain(t('上次表决'));
        });

        it(`${locale}: public vote marks explain their meaning without exposing private ballots`, () => {
            setLocale(locale);
            const state = avalon.create(players, 19);
            state.stage = 'approve';
            state.publicVotes = { p0: true, p1: false };
            const markup = renderToStaticMarkup(createElement(AvalonBoard, {
                view: avalon.view(state, 'p0'), selfID: 'p0', open: () => {},
            }));
            expect(markup).toContain(`aria-label="${t('上次表决')}"`);
            const label = markup.match(/aria-label="([^\"]*Player 1[^\"]*)"/)?.[1];
            expect(label).toContain(`${t('上次表决')} · ${t('反对')}`);
            state.publicVotes = {};
            const pending = renderToStaticMarkup(createElement(AvalonBoard, {
                view: avalon.view(state, 'p0'), selfID: 'p0', open: () => {},
            }));
            expect(pending).not.toContain('vote-mark');
            expect(pending).not.toContain(t('上次表决'));
        });
    }
});
