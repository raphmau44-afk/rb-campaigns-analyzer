const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const API_BASE = 'https://api.pinterest.com/v5';
const PASSWORD = process.env.APP_PASSWORD || 'pinads2024';
const PERF_KEYWORDS = ['performance+','perf+','perf +','performance plus','broad p+','broad perf+','advantage+','adv+'];

function isPP(name) {
  const n = (name || '').toLowerCase();
  return PERF_KEYWORDS.some(k => n.includes(k));
}

async function fetchAll(token, endpoint, params) {
  let items = [], bookmark = null;
  do {
    const bm = bookmark ? (params ? '&' : '') + 'bookmark=' + bookmark : '';
    const url = API_BASE + '/' + endpoint + (params || bm ? '?' + (params||'') + bm : '');
    const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    if (!r.ok) { let msg = 'API ' + r.status; try { const e = await r.json(); msg = e.message || msg; } catch(x){} throw new Error(msg); }
    const d = await r.json();
    items = items.concat(d.items || []);
    bookmark = d.bookmark || null;
  } while (bookmark);
  return items;
}

async function analyzeCampaigns(token, accountId) {
  const [allCamps, allGroups, allAds] = await Promise.all([
    fetchAll(token, 'ad_accounts/' + accountId + '/campaigns', 'page_size=250'),
    fetchAll(token, 'ad_accounts/' + accountId + '/ad_groups', 'page_size=250'),
    fetchAll(token, 'ad_accounts/' + accountId + '/ads', 'page_size=250'),
  ]);
  const activeCamps = allCamps.filter(c => c.status === 'ACTIVE');
  const activeGroups = allGroups.filter(g => g.status === 'ACTIVE');
  const activeAds = allAds.filter(a => a.status === 'ACTIVE');
  const groupsByCamp = {};
  for (const g of activeGroups) { if (!groupsByCamp[g.campaign_id]) groupsByCamp[g.campaign_id] = []; groupsByCamp[g.campaign_id].push(g); }
  const adsByGroup = {};
  for (const a of activeAds) { adsByGroup[a.ad_group_id] = (adsByGroup[a.ad_group_id] || 0) + 1; }
  return activeCamps.map(camp => {
    const t = isPP(camp.name) ? 10 : 5;
    const groups = groupsByCamp[camp.id] || [];
    if (groups.length > 1) {
      const adsets = groups.map(ag => { const active = adsByGroup[ag.id] || 0; return { id: ag.id, name: ag.name, active, target: t, gap: t - active }; });
      const totalActive = adsets.reduce((s,a) => s+a.active, 0);
      const totalTarget = adsets.reduce((s,a) => s+a.target, 0);
      return { id: camp.id, name: camp.name, isPerfPlus: isPP(camp.name), hasAdsets: true, adsets, totalActive, totalTarget, totalGap: totalTarget - totalActive };
    } else {
      const active = groups.reduce((s,g) => s+(adsByGroup[g.id]||0), 0);
      return { id: camp.id, name: camp.name, isPerfPlus: isPP(camp.name), hasAdsets: false, adsets: [], active, target: t, gap: t - active };
    }
  });
}

app.post('/auth', (req, res) => {
  if (req.body.password === PASSWORD) return res.json({ success: true, token: PASSWORD });
  res.status(401).json({ error: 'Mot de passe incorrect' });
});

app.post('/analyze', async (req, res) => {
  if (req.headers['x-app-token'] !== PASSWORD) return res.status(401).json({ error: 'Non autorisé' });
  if (!req.body.pinToken || !req.body.accountId) return res.status(400).json({ error: 'pinToken et accountId requis' });
  try {
    const results = await analyzeCampaigns(req.body.pinToken, req.body.accountId);
    res.json({ success: true, results, analyzedAt: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => console.log('RB Campaigns Analyzer running on port ' + PORT));
