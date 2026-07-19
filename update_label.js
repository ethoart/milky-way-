const fs = require('fs');
let content = fs.readFileSync('components/LabelPrintView.tsx', 'utf8');
content = content.replace('grid-template-columns: 1fr 1fr;', 'grid-template-columns: repeat(3, 1fr);');
content = content.replace('height: 99mm;', 'height: 99mm;');
content = content.replace(/6/g, '9');
fs.writeFileSync('components/LabelPrintView.tsx', content);
