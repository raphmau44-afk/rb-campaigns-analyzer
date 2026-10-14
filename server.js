const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data', 'accounts.json');
const PASSWORD = process.env.APP_PASSWORD || 'pinads2024';

if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ accounts: [] }));

function load() { try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e) { return { accounts: [] }; } }
function save(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); }
function auth(req, res, next) { if (req.headers['x-app-token'] !== PASSWORD) return res.status(401).json({ error: 'Non autorisé' }); next(); }

app.post('/auth', (req, res) => {
  if (req.body.password === PASSWORD) return res.json({ success: true, token: PASSWORD });
  res.status(401).json({ error: 'Mot de passe incorrect' });
});
app.get('/accounts', auth, (req, res) => {
  const d = load();
  res.json({ accounts: d.accounts.map(a => ({ id: a.id, name: a.name, accountId: a.accountId, token: a.token })) });
});
app.post('/accounts', auth, (req, res) => {
  const { id, name, accountId, token } = req.body;
  if (!name || !accountId || !token) return res.status(400).json({ error: 'Champs manquants' });
  const d = load();
  const acc = { id: id || Date.now().toString(), name, accountId, token };
  const idx = d.accounts.findIndex(a => a.id === id);
  if (idx >= 0) d.accounts[idx] = acc; else d.accounts.push(acc);
  save(d); res.json({ success: true, account: acc });
});
app.delete('/accounts/:id', auth, (req, res) => {
  const d = load();
  d.accounts = d.accounts.filter(a => a.id !== req.params.id);
  save(d); res.json({ success: true });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => console.log('RB Campaigns Analyzer running on port ' + PORT));
