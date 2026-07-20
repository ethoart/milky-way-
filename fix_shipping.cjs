const fs = require('fs');
let content = fs.readFileSync('pages/ShippingPipeline.tsx', 'utf8');

content = content.replace(
  `const [startDate, setStartDate] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return getSLDateString(d);
  });`,
  `const [startDate, setStartDate] = useState(() => {
      const d = new Date();
      d.setDate(1);
      return getSLDateString(d);
  });`
);
content = content.replace(
  `const [endDate, setEndDate] = useState(getSLDateString());`,
  `const [endDate, setEndDate] = useState(() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      d.setDate(0);
      return getSLDateString(d);
  });`
);

fs.writeFileSync('pages/ShippingPipeline.tsx', content);
console.log("Fixed ShippingPipeline");
