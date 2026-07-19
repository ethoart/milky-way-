const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');
content = content.replace(
  "if (r._id === 'RESIDUAL') { stats.restockCount = r.count; stats.restockValue = r.value; } // simplistic mapping",
  "if (r._id === 'RETURN_COMPLETED') { stats.restockCount = r.count; stats.restockValue = r.value; }"
);
fs.writeFileSync('server.js', content);
