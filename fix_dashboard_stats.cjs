const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');
content = content.replace(
  "stats: globalStats ? globalStats : {",
  "stats: {"
);
fs.writeFileSync('pages/Dashboard.tsx', content);
