const fs = require('fs');
let s = fs.readFileSync('server.js','utf8');
s = s.replace(/status=RUNNING/g, 'status=ACTIVE');
s = s.replace(/status=APPROVED/g, 'status=ACTIVE');
fs.writeFileSync('server.js', s);
console.log('Corrigé');
