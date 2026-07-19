const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');

// Update preset default
content = content.replace(
  "const [preset, setPreset] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL'>('ALL');",
  "const [preset, setPreset] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL'>('MONTH');"
);
content = content.replace(
  "useEffect(() => { applyPreset('ALL'); }, [applyPreset]);",
  "useEffect(() => { applyPreset('MONTH'); }, [applyPreset]);"
);

// Update db.getOrders params
content = content.replace(
  "db.getOrders({ tenantId, limit: 5000 })",
  "db.getOrders({ tenantId, limit: 10000, startDate, endDate })"
);

// Update fetchData dependencies
content = content.replace(
  "}, [tenantId]);",
  "}, [tenantId, startDate, endDate]);"
);

fs.writeFileSync('pages/Dashboard.tsx', content);
