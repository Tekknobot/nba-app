// Offline tests with ESPN-shaped fixtures. Run: node --test tests/nba-data.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const API_FILE = require.resolve('../api/nba-data');
function freshApi(fetcher) {
  delete require.cache[API_FILE];
  global.fetch = fetcher;
  return require(API_FILE).handleAction;
}
function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
function event(id, iso, away, home, awayScore, homeScore, stage = 2, done = true, includeSeason = true) {
  const ev = {
    id, date: iso,
    status: { type: { state: done ? 'post' : 'pre', completed: done, description: done ? 'Final' : 'Scheduled' } },
    competitions: [{
      id, date: iso,
      // ESPN competition.type = standard game; never season stage.
      type: { id: '1', abbreviation: 'STD' },
      competitors: [
        { homeAway: 'home', team: { id: home === 'BOS' ? '2' : '13', abbreviation: home, displayName: home }, score: String(homeScore) },
        { homeAway: 'away', team: { id: away === 'BOS' ? '2' : '13', abbreviation: away, displayName: away }, score: String(awayScore) },
      ],
    }],
  };
  if (includeSeason) ev.season = { year: 2027, type: stage };
  return ev;
}
function path(url) { return new URL(String(url)); }

test('regular-season schedule with missing season metadata is not mistaken for preseason', async () => {
  const finished = event('101', '2026-10-26T23:00:00Z', 'LAL', 'BOS', 101, 108, 2, true, false);
  const api = freshApi(async (url) => {
    const u = path(url);
    if (u.pathname.endsWith('/schedule')) return response({ events: [finished] });
    if (u.pathname.endsWith('/scoreboard')) return response({ events: [] });
    throw new Error('Unexpected fetch: ' + u);
  });
  const r = await api({ action: 'team-last10', team: 'BOS', anchor: '2026-11-02' });
  assert.equal(r.games.length, 1);
  assert.equal(r.games[0].result, 'W');
  assert.equal(r.games[0].seasonStageId, 2);
});

test('scoreboard fallback finds completed regular-season games but excludes preseason, future games, and repeats', async () => {
  const regular = event('102', '2026-10-30T23:00:00Z', 'BOS', 'LAL', 112, 108);
  const preseason = event('103', '2026-10-08T23:00:00Z', 'BOS', 'LAL', 88, 94, 1);
  const future = event('104', '2026-11-04T02:00:00Z', 'BOS', 'LAL', 0, 0, 2, false);
  const api = freshApi(async (url) => {
    const u = path(url);
    if (u.pathname.endsWith('/schedule')) return response({ events: [] });
    if (u.pathname.endsWith('/scoreboard')) return response({ events: [regular, regular, preseason, future] });
    throw new Error('Unexpected fetch: ' + u);
  });
  const r = await api({ action: 'team-last10', team: 'BOS', anchor: '2026-11-02' });
  assert.equal(r.games.length, 1);
  assert.equal(r.games[0].date, '2026-10-30');
  assert.equal(r.games[0].result, 'W');
  assert.equal(r.games[0].opp, 'LAL');
});

test('team schedule outage falls back to scoreboard', async () => {
  const winner = event('106', '2026-10-25T23:00:00Z', 'LAL', 'BOS', 100, 108);
  let failed = 0;
  const api = freshApi(async (url) => {
    const u = path(url);
    if (u.pathname.endsWith('/schedule')) { failed += 1; return response({}, 500); }
    if (u.pathname.endsWith('/scoreboard')) return response({ events: [winner] });
    throw new Error('Unexpected fetch: ' + u);
  });
  const r = await api({ action: 'team-last10', team: 'BOS', anchor: '2026-11-02' });
  assert.equal(failed, 1);
  assert.equal(r.games.length, 1);
});

test('does not report an empty season when schedule and scoreboard both fail', async () => {
  const api = freshApi(async () => response({}, 500));
  await assert.rejects(api({ action: 'team-last10', team: 'BOS', anchor: '2026-11-02' }), /temporarily unavailable/);
});

test('does not include a game after the requested historical anchor date', async () => {
  const older = event('111', '2026-10-26T01:30:00Z', 'BOS', 'LAL', 111, 110);
  const newer = event('112', '2026-10-28T01:30:00Z', 'BOS', 'LAL', 120, 119);
  const api = freshApi(async (url) => {
    const u = path(url);
    if (u.pathname.endsWith('/schedule')) return response({ events: [older, newer] });
    if (u.pathname.endsWith('/scoreboard')) return response({ events: [older, newer] });
    throw new Error('Unexpected fetch: ' + u);
  });
  const r = await api({ action: 'team-last10', team: 'BOS', anchor: '2026-10-25' });
  assert.deepEqual(r.games.map(g => g.date), ['2026-10-25']);
});

test('concurrent requests share a single in-flight ESPN scoreboard download', async () => {
  const ev = event('123', '2026-10-26T23:00:00Z', 'LAL', 'BOS', 101, 107);
  let scoreboardFetches = 0;
  const api = freshApi(async (url) => {
    const u = path(url);
    if (u.pathname.endsWith('/schedule')) return response({ events: [] });
    if (u.pathname.endsWith('/scoreboard')) {
      scoreboardFetches += 1;
      await new Promise(resolve => setTimeout(resolve, 12));
      return response({ events: [ev] });
    }
    throw new Error('Unexpected fetch: ' + u);
  });
  const [a, b] = await Promise.all([
    api({ action: 'team-last10', team: 'BOS', anchor: '2026-11-02' }),
    api({ action: 'team-last10', team: 'LAL', anchor: '2026-11-02' }),
  ]);
  assert.equal(a.games.length, 1);
  assert.equal(b.games.length, 1);
  // October + November each needed once, rather than twice per team.
  assert.equal(scoreboardFetches, 2);
});

test('an ESPN final with missing scores is not silently shown as a 0–0 result', async () => {
  const unscored = event('130', '2026-10-30T23:00:00Z', 'LAL', 'BOS', null, null);
  unscored.competitions[0].competitors.forEach(c => { delete c.score; });
  const api = freshApi(async (url) => {
    const u = path(url);
    if (u.pathname.endsWith('/schedule')) return response({ events: [unscored] });
    if (u.pathname.endsWith('/scoreboard')) return response({ events: [unscored] });
    throw new Error('Unexpected fetch: ' + u);
  });
  const r = await api({ action: 'team-last10', team: 'BOS', anchor: '2026-11-02' });
  assert.equal(r.games.length, 0);
});

test('preseason matchup selects preseason results without leaking regular-season games', async () => {
  const pre = event('131', '2026-10-09T23:00:00Z', 'LAL', 'BOS', 90, 102, 1);
  const regular = event('132', '2026-10-29T23:00:00Z', 'LAL', 'BOS', 111, 112, 2);
  const api = freshApi(async (url) => {
    const u = path(url);
    if (u.pathname.endsWith('/schedule')) return response({ events: [pre] });
    if (u.pathname.endsWith('/scoreboard')) return response({ events: [pre, regular] });
    throw new Error('Unexpected fetch: ' + u);
  });
  const r = await api({ action: 'team-last10', team: 'BOS', anchor: '2026-10-15', stage: '1' });
  assert.equal(r.games.length, 1);
  assert.equal(r.games[0].seasonStageId, 1);
});
