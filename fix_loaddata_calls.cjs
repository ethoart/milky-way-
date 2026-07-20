const fs = require('fs');
let content = fs.readFileSync('pages/OrderDetail.tsx', 'utf8');
content = content.split('loadData()').join('loadData(true)');
content = content.split('useEffect(() => { loadData(true); }, [loadData])').join('useEffect(() => { loadData(false); }, [loadData])');
fs.writeFileSync('pages/OrderDetail.tsx', content);
console.log("Fixed all loadData calls");
