const fs = require('fs');
let content = fs.readFileSync('pages/OrderDetail.tsx', 'utf8');

const regex = /const hasLoadedRef = useRef\(false\);/;
const replaceStr = `const hasLoadedRef = useRef(false);
  const prevOrderIdRef = useRef(orderId);
  if (prevOrderIdRef.current !== orderId) {
      hasLoadedRef.current = false;
      prevOrderIdRef.current = orderId;
  }`;

content = content.replace(regex, replaceStr);

fs.writeFileSync('pages/OrderDetail.tsx', content);
console.log("Fixed ref reset on orderId change");
