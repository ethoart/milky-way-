const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');

const oldPreset = `  const applyPreset = useCallback((p: 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL') => {
    setPreset(p);
    const d = new Date();
    if (p === 'TODAY') {
        // Just use current SL date
    } else if (p === 'WEEK') d.setDate(d.getDate() - 7);
    else if (p === 'MONTH') d.setMonth(d.getMonth() - 1);
    else if (p === 'YEAR') d.setFullYear(d.getFullYear() - 1);
    
    setStartDate(p === 'ALL' ? '2020-01-01' : getSLDateString(d));
    setEndDate(getSLDateString(new Date()));
  }, []);`;

const newPreset = `  const applyPreset = useCallback((p: 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL') => {
    setPreset(p);
    const d = new Date();
    if (p === 'TODAY') {
        setStartDate(getSLDateString(d));
        setEndDate(getSLDateString(new Date()));
    } else if (p === 'WEEK') {
        d.setDate(d.getDate() - 7);
        setStartDate(getSLDateString(d));
        setEndDate(getSLDateString(new Date()));
    } else if (p === 'MONTH') {
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        setStartDate(getSLDateString(firstDay));
        setEndDate(getSLDateString(lastDay));
    } else if (p === 'YEAR') {
        d.setFullYear(d.getFullYear() - 1);
        setStartDate(getSLDateString(d));
        setEndDate(getSLDateString(new Date()));
    } else if (p === 'ALL') {
        setStartDate('2020-01-01');
        setEndDate(getSLDateString(new Date()));
    }
  }, []);`;

content = content.replace(oldPreset, newPreset);
fs.writeFileSync('pages/Dashboard.tsx', content);
console.log("Fixed dashboard preset");
