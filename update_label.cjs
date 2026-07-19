const fs = require('fs');
let content = fs.readFileSync('components/LabelPrintView.tsx', 'utf8');
content = content.replace('grid-template-columns: 1fr 1fr;', 'grid-template-columns: repeat(3, 1fr);');
// Replace pagination numbers (6) with (9)
content = content.replace(/Math.ceil\(orders.length \/ 6\)/g, 'Math.ceil(orders.length / 9)');
content = content.replace(/pageIdx \* 6/g, 'pageIdx * 9');
content = content.replace(/\(pageIdx \+ 1\) \* 6/g, '(pageIdx + 1) * 9');
content = content.replace(/length: 6 -/g, 'length: 9 -');
content = content.replace(/padding: 6mm 7mm;/g, 'padding: 4mm 5mm;');

// Also fix some text sizes to fit smaller width (70mm instead of 105mm)
content = content.replace('text-[34px]', 'text-[24px]');
content = content.replace('text-[18px]', 'text-[14px]');
content = content.replace('text-[15px]', 'text-[12px]');

fs.writeFileSync('components/LabelPrintView.tsx', content);
