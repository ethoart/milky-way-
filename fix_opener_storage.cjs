const fs = require('fs');
let content = fs.readFileSync('pages/OrderDetail.tsx', 'utf8');

const targetStr = `            const preOrder = localStorage.getItem('pre_order_' + orderId);
            if (preOrder) {`;

const replaceStr = `            let preOrder = localStorage.getItem('pre_order_' + orderId);
            let activeStorage = window.localStorage;
            if (!preOrder && window.opener && window.opener !== window) {
                try {
                    preOrder = window.opener.localStorage.getItem('pre_order_' + orderId);
                    activeStorage = window.opener.localStorage;
                } catch(e) {}
            }

            if (preOrder) {`;

content = content.replace(targetStr, replaceStr);

const targetStr2 = `                    const pCache = localStorage.getItem('cache_products_' + tenantId);`;
const replaceStr2 = `                    const pCache = activeStorage.getItem('cache_products_' + tenantId);`;
content = content.replace(targetStr2, replaceStr2);

const targetStr3 = `                    const cCache = localStorage.getItem('cache_cities');`;
const replaceStr3 = `                    const cCache = activeStorage.getItem('cache_cities');`;
content = content.replace(targetStr3, replaceStr3);

const targetStr4 = `                    const tCache = localStorage.getItem('cache_tenants');`;
const replaceStr4 = `                    const tCache = activeStorage.getItem('cache_tenants');`;
content = content.replace(targetStr4, replaceStr4);

fs.writeFileSync('pages/OrderDetail.tsx', content);
console.log("Updated OrderDetail to use window.opener storage fallback");
