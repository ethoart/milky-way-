const fs = require('fs');

const filesToFix = [
  {
    path: 'pages/ResidualManagement.tsx',
    oldLogic: `  const applyPreset = (preset: 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR') => {
    const end = new Date();
    const start = new Date();
    if (preset === 'WEEK') start.setDate(end.getDate() - 7);
    if (preset === 'MONTH') start.setMonth(end.getMonth() - 1);
    if (preset === 'YEAR') start.setFullYear(end.getFullYear() - 1);
    
    setStartDate(getSLDateString(start));
    setEndDate(getSLDateString(end));
  };`,
    newLogic: `  const applyPreset = (preset: 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR') => {
    const end = new Date();
    const start = new Date();
    if (preset === 'WEEK') start.setDate(end.getDate() - 7);
    if (preset === 'MONTH') {
        start.setDate(1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
    }
    if (preset === 'YEAR') start.setFullYear(end.getFullYear() - 1);
    
    setStartDate(getSLDateString(start));
    setEndDate(getSLDateString(end));
  };`
  },
  {
    path: 'pages/ReturnManagement.tsx',
    oldLogic: `  const applyPreset = (preset: 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR') => {
    const end = new Date();
    const start = new Date();
    if (preset === 'WEEK') start.setDate(end.getDate() - 7);
    if (preset === 'MONTH') start.setMonth(end.getMonth() - 1);
    if (preset === 'YEAR') start.setFullYear(end.getFullYear() - 1);
    
    setStartDate(getSLDateString(start));
    setEndDate(getSLDateString(end));
  };`,
    newLogic: `  const applyPreset = (preset: 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR') => {
    const end = new Date();
    const start = new Date();
    if (preset === 'WEEK') start.setDate(end.getDate() - 7);
    if (preset === 'MONTH') {
        start.setDate(1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
    }
    if (preset === 'YEAR') start.setFullYear(end.getFullYear() - 1);
    
    setStartDate(getSLDateString(start));
    setEndDate(getSLDateString(end));
  };`
  },
  {
    path: 'pages/ShippingPipeline.tsx',
    oldLogic: `  const applyPreset = (preset: 'TODAY' | 'WEEK' | 'MONTH') => {
    const end = new Date();
    const start = new Date();
    if (preset === 'WEEK') start.setDate(end.getDate() - 7);
    if (preset === 'MONTH') start.setMonth(end.getMonth() - 1);
    
    setStartDate(getSLDateString(start));
    setEndDate(getSLDateString(end));
  };`,
    newLogic: `  const applyPreset = (preset: 'TODAY' | 'WEEK' | 'MONTH') => {
    const end = new Date();
    const start = new Date();
    if (preset === 'WEEK') start.setDate(end.getDate() - 7);
    if (preset === 'MONTH') {
        start.setDate(1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
    }
    
    setStartDate(getSLDateString(start));
    setEndDate(getSLDateString(end));
  };`
  }
];

filesToFix.forEach(f => {
  if (fs.existsSync(f.path)) {
    let content = fs.readFileSync(f.path, 'utf8');
    content = content.replace(f.oldLogic, f.newLogic);
    fs.writeFileSync(f.path, content);
    console.log("Fixed " + f.path);
  }
});
