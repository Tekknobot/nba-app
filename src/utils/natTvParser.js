// src/utils/natTvParser.js
// Parses the national TV schedule plaintext into the calendar's row shape.

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

// Accepts the full text blob and returns rows shaped for the calendar.
export function parseNatSchedule(text) {
  if (!text) return [];
  const lines = String(text).split(/\n+/).map(s => s.trim()).filter(Boolean);
  const rows = [];

  // Example match:
  // Tue. 10/21/25 Houston at Oklahoma City 6:30 PM 7:30 PM NBC/Peacock R
  // Sat. 11/1/25  Dallas vs Detroit 8:00 PM 10:00 PM Peacock A
  const re=/^(Sun\.|Mon\.|Tue\.|Wed\.|Thu\.|Fri\.|Sat\.)\s+(\d{1,2}\/\d{1,2}\/\d{2})\s+(.+?)\s+(at|vs)\s+(.+?)\s+(\d{1,2}:\d{2}\s*[AP]M)\s+(\d{1,2}:\d{2}\s*[AP]M)\b/i;

  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const [, , mdy, t1, atvs, t2, , et] = m;

    const [mm,dd,yy]=mdy.split('/').map(Number);
    const yyyy = yy + 2000;
    const dateKey = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
    const iso = new Date(`${dateKey}T${to24h(et)}:00`).toISOString();

    const c1 = NAME_TO_CODE.get(NAME_KEY(t1)) || null;
    const c2 = NAME_TO_CODE.get(NAME_KEY(t2)) || null;

    // Push both home/away perspectives for filtering by team
    rows.push({
      _iso: iso, dateKey, et: et.trim(),
      opp: t2,
      homeAway: atvs.toLowerCase()==='at' ? 'Away' : 'Home',
      seasonStageId: 2, _final: false, _teamCode: c1, _teamName: t1
    });
    rows.push({
      _iso: iso, dateKey, et: et.trim(),
      opp: t1,
      homeAway: atvs.toLowerCase()==='at' ? 'Home' : 'Away',
      seasonStageId: 2, _final: false, _teamCode: c2, _teamName: t2
    });
  }

  return rows.sort((a,b)=> String(a.dateKey).localeCompare(String(b.dateKey)) || String(a._iso).localeCompare(String(b._iso)));
}
