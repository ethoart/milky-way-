const fs = require('fs');
let content = fs.readFileSync('pages/OrderList.tsx', 'utf8');

const targetStr = `  const handleOrderClick = (e: React.MouseEvent, orderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      const url = \`\${window.location.origin}\${window.location.pathname}?orderId=\${orderId}\`;
      window.open(url, '_blank');
    } else {
      onSelectOrder(orderId);
    }
  };`;

const replaceStr = `  const handleOrderClick = (e: React.MouseEvent, orderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const orderObj = orders.find(o => o.id === orderId);
    if (orderObj) {
        localStorage.setItem('pre_order_' + orderId, JSON.stringify(orderObj));
    }
    if (e.ctrlKey || e.metaKey) {
      const url = \`\${window.location.origin}\${window.location.pathname}?orderId=\${orderId}\`;
      window.open(url, '_blank');
    } else {
      onSelectOrder(orderId);
    }
  };`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('pages/OrderList.tsx', content);
console.log("Updated OrderList to preload orders");
