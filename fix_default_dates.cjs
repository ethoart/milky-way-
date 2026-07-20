const fs = require('fs');

const files = [
    { name: 'pages/FinancialCenter.tsx', hasDate: true },
    { name: 'pages/ResidualManagement.tsx', hasDate: true },
    { name: 'pages/ReturnManagement.tsx', hasDate: true },
    { name: 'pages/SellingPipeline.tsx', hasDate: true },
    { name: 'pages/ShippingPipeline.tsx', hasDate: true },
    { name: 'pages/Dashboard.tsx', hasDate: true }
];

files.forEach(f => {
    let content = fs.readFileSync(f.name, 'utf8');
    
    // Replace any instance of `new Date().setDate(new Date().getDate() - 30)` or similar
    // Actually it's better to just regex the exact text.
    if (f.name === 'pages/FinancialCenter.tsx') {
        content = content.replace(
            `const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });`,
            `const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    return first.toISOString().split('T')[0];
  });`
        );
        content = content.replace(
            `const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);`,
            `const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return last.toISOString().split('T')[0];
  });`
        );
    }
    
    // For others, let's just find `const [startDate, setStartDate] = useState(` and see what's there
    fs.writeFileSync(f.name, content);
});
