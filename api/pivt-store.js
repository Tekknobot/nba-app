const { neon } = require('@neondatabase/serverless');
const { handleAction } = require('./nba-data');
const START_AT = '2026-10-09T03:30:00.000Z'; // Fresh record starts after the prior preseason snapshots.
const sqlClient = () => process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const todayET = () => { const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const value = type => parts.find(x => x.type === type)?.value; return `${value('year')}-${value('month')}-${value('day')}`; };
const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
async function ensure(sql) { await sql`CREATE TABLE IF NOT EXISTS pivt3_slates (date text PRIMARY KEY, snapshot jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`; }
const team = t => ({ code: t?.code || '', name: t?.name || t?.code || '', logo: t?.logo || '' });
const compact = row => {
 const g = row?.game || {}, p = row?.prediction || {};
 return { gameId: String(g.id || ''), dateKey: g.dateKey || '', iso: g._iso || '', away: team(g.away), home: team(g.home), pick: p.pick || '', awayProbability: Number(p.awayProbability) || 50, homeProbability: Number(p.homeProbability) || 50, confidence: p.confidence || 'low', factors: Array.isArray(p.factors) ? p.factors.slice(0,4) : [], model: p.model || '', modelVersion: p.modelVersion || 'legacy-v1', seasonType: p.seasonType || g.seasonStageId || null, result: null };
};
async function capture(date, rows) {
 const sql = sqlClient();
 if (!sql || !isoDate(date) || !Array.isArray(rows) || !rows.length) return;
 const today = todayET();
 const max = new Date(`${today}T12:00:00Z`); max.setUTCDate(max.getUTCDate()+14);
 if (date < today || date > max.toISOString().slice(0,10)) return;
 const picks = rows.slice(0,3);
 if (picks.some(row => row?.game?.completed || row?.game?.state === 'in' || /final|in progress|halftime|quarter|q\d|end of/i.test(String(row?.game?.status || '')))) return;
 if (date === today && picks.some(row => row?.game?._iso && new Date(row.game._iso).getTime() <= Date.now())) return;
 const snapshot = { date, recordedAt: new Date().toISOString(), picks: picks.map(compact) };
 await ensure(sql);
 await sql`INSERT INTO pivt3_slates (date, snapshot) VALUES (${date}, ${JSON.stringify(snapshot)}::jsonb) ON CONFLICT (date) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()
  WHERE (pivt3_slates.snapshot->>'recordedAt') < ${START_AT}`;
}
async function list() {
 const sql=sqlClient(); if(!sql) throw new Error('DATABASE_URL is not configured');
 await ensure(sql);
 // Loading the record page also captures today's pre-tipoff slate, if available.
 try { const today = todayET(); const data = await handleAction({action:'top-picks',date:today}); await capture(today, data.picks || []); }
 catch(error) { console.error('PIVT daily capture',error); }
 const rows=await sql`SELECT date, snapshot FROM pivt3_slates WHERE (snapshot->>'recordedAt') >= ${START_AT} ORDER BY date DESC LIMIT 2000`;
 const pending=rows.filter(r => r.snapshot?.picks?.some(p => !p?.result?.completed));
 // Verify existing picks on the server. Never change frozen predictions.
 const months=[...new Set(pending.map(r=>r.date.slice(0,7)))];
 if(months.length) {
  const games=(await Promise.all(months.map(async value => {
   const [year,month]=value.split('-').map(Number);
   try { return (await handleAction({action:'month',year:String(year),month:String(month)})).games || []; }
   catch(err) { console.error('PIVT verification feed',err);return []; }
  }))).flat();
  const byId=new Map(games.map(g=>[String(g.id),g]));
  for(const row of pending) {
   let changed=false;
   const updated={...row.snapshot,picks:row.snapshot.picks.map(p=>{
    if(p.result?.completed) return p;
    const g=byId.get(String(p.gameId));
    const away=Number(g?.awayScore),home=Number(g?.homeScore);
    if(!g || !(g.completed || /final/i.test(String(g.status||''))) || !Number.isFinite(away) || !Number.isFinite(home) || away===home) return p;
    changed=true;
    return {...p,result:{completed:true,status:g.status||'FINAL',actualWinner:away>home?g.away?.code:g.home?.code,awayScore:away,homeScore:home,verifiedAt:new Date().toISOString()}};
   })};
   if(changed) {
    await sql`UPDATE pivt3_slates SET snapshot = ${JSON.stringify(updated)}::jsonb, updated_at=now() WHERE date=${row.date}`;
    row.snapshot=updated;
   }
  }
 }
 return rows.map(r=>r.snapshot);
}
module.exports={capture,list,START_AT};
