const fs = require('fs');
let content = fs.readFileSync('pages/FinancialCenter.tsx', 'utf8');

content = content.replace(
  `const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);`,
  `const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });`
);
fs.writeFileSync('pages/FinancialCenter.tsx', content);
