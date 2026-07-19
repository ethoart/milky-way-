const fs = require('fs');
let content = fs.readFileSync('pages/ReturnManagement.tsx', 'utf8');

const t1 = `const result: any = await db.processReturn(scanInput, tenantId);`;
const rep1 = `const currentUser = localStorage.getItem('mw_user') ? JSON.parse(localStorage.getItem('mw_user')!).username : 'System';
      const result: any = await db.processReturn(scanInput, tenantId, currentUser);`;

content = content.replace(t1, rep1);

fs.writeFileSync('pages/ReturnManagement.tsx', content);
console.log("Fixed ReturnManagement");
