// Convert your JSON rows → calendar row shape.
// Supports BOTH inputs:
//  A) raw list: { date, team1, at_vs, team2, et, ... }  (from the CSV/JSON builder)
//  B) already-normalized rows: { dateKey, _teamCode, _teamName, et, ... } (passthrough)

const TEAMS = [
  { code: 'ATL', name: 'Atlanta Hawks' }, { code: 'BOS', name: 'Boston Celtics' },
  { code: 'BKN', name: 'Brooklyn Nets' }, { code: 'CHA', name: 'Charlotte Hornets' },
  { code: 'CHI', name: 'Chicago Bulls' }, { code: 'CLE', name: 'Cleveland Cavaliers' },
  { code: 'DAL', name: 'Dallas Mavericks' }, { code: 'DEN', name: 'Denver Nuggets' },
  { code: 'DET', name: 'Detroit Pistons' }, { code: 'GSW', name: 'Golden State Warriors' },
  { code: 'HOU', name: 'Houston Rockets' }, { code: 'IND', name: 'Indiana Pacers' },
  { code: 'LAC', name: 'LA Clippers' },    { code: 'LAL', name: 'L.A. Lakers' },
  { code: 'MEM', name: 'Memphis Grizzlies' }, { code: 'MIA', name: 'Miami Heat' },
  { code: 'MIL', name: 'Milwaukee Bucks' }, { code: 'MIN', name: 'Minnesota Timberwolves' },
  { code: 'NOP', name: 'New Orleans Pelicans' }, { code: 'NYK', name: 'New York Knicks' },
  { code: 'OKC', name: 'Oklahoma City Thunder' }, { code: 'ORL', name: 'Orlando Magic' },
  { code: 'PHI', name: 'Philadelphia 76ers' }, { code: 'PHX', name: 'Phoenix Suns' },
  { code: 'POR', name: 'Portland Trail Blazers' }, { code: 'SAC', name: 'Sacramento Kings' },
  { code: 'SAS', name: 'San Antonio Spurs' }, { code: 'TOR', name: 'Toronto Raptors' },
  { code: 'UTA', name: 'Utah Jazz' }, { code: 'WAS', name: 'Washington Wizards' },
];

const NAME_KEY = s => String(s).toLowerCase().replace(/[^a-z]/g,'');
const NAME_TO_CODE = new Map(TEAMS.map(t => [NAME_KEY(t.name), t.code]));
[
  ['Atlanta','ATL'],['Boston','BOS'],['Brooklyn','BKN'],['Charlotte','CHA'],
  ['Chicago','CHI'],['Cleveland','CLE'],['Dallas','DAL'],['Denver','DEN'],
  ['Detroit','DET'],['Golden State','GSW'],['Houston','HOU'],['Indiana','IND'],
  ['Memphis','MEM'],['Miami','MIA'],['Milwaukee','MIL'],['Minnesota','MIN'],
  ['New Orleans','NOP'],['New York','NYK'],['Oklahoma City','OKC'],['Orlando','ORL'],
  ['Philadelphia','PHI'],['Phoenix','PHX'],['Portland','POR'],['Sacramento','SAC'],
  ['San Antonio','SAS'],['Toronto','TOR'],['Utah','UTA'],['Washington','WAS'],
].forEach(([label, code]) => NAME_TO_CODE.set(NAME_KEY(label), code));
NAME_TO_CODE.set(NAME_KEY('LA Clippers'), 'LAC');
NAME_TO_CODE.set(NAME_KEY('Los Angeles Lakers'), 'LAL');
NAME_TO_CODE.set(NAME_KEY('LA Lakers'), 'LAL');
NAME_TO_CODE.set(NAME_KEY('L.A. Lakers'), 'LAL');

function to24h(t){
  const m=t?.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if(!m) return '00:00';
  let h=+m[1]; const min=m[2]; const ap=m[3].toUpperCase();
  if(ap==='PM' && h!==12) h+=12;
  if(ap==='AM' && h===12) h=0;
  return `${String(h).padStart(2,'0')}:${min}`;
}

function alreadyNormalized(rows){
  // treat as normalized if typical calendar fields exist
  const r = rows?.[0] || {};
  return r.dateKey && (r._teamCode || r._teamName);
}

/** @param {Array} jsonRows */
export function normalizeNatTvJson(jsonRows) {
  if (!Array.isArray(jsonRows)) return [];

  // Passthrough: the Canada JSON you built already has calendar rows
  if (alreadyNormalized(jsonRows)) {
    // ensure stable sort
    return [...jsonRows].sort(
      (a,b)=> String(a.dateKey).localeCompare(String(b.dateKey)) ||
              String(a._iso||"").localeCompare(String(b._iso||""))
    );
  }

  // RAW rows → normalize
  const rows = [];
  for (const r of jsonRows || []) {
    const dateKey = r.date;          // "YYYY-MM-DD"
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || "")) continue;

    const et = (r.et || '').trim();  // "7:30 PM" or "TBD"
    const iso = new Date(`${dateKey}T${to24h(et)}:00`).toISOString();

    const t1 = r.team1, t2 = r.team2;
    const atvs = String(r.at_vs || '').toLowerCase(); // 'at' | 'vs'

    const c1 = NAME_TO_CODE.get(NAME_KEY(t1)) || null;
    const c2 = NAME_TO_CODE.get(NAME_KEY(t2)) || null;

    // TEAM1 perspective
    rows.push({
      _iso: iso, dateKey, et,
      opp: t2,
      homeAway: atvs === 'at' ? 'Away' : 'Home',
      seasonStageId: 2, _final: false, _teamCode: c1, _teamName: t1
    });
    // TEAM2 perspective
    rows.push({
      _iso: iso, dateKey, et,
      opp: t1,
      homeAway: atvs === 'at' ? 'Home' : 'Away',
      seasonStageId: 2, _final: false, _teamCode: c2, _teamName: t2
    });
  }

  return rows.sort(
    (a,b)=> String(a.dateKey).localeCompare(String(b.dateKey)) ||
            String(a._iso||"").localeCompare(String(b._iso||""))
  );
}
