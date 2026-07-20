const fs = require('fs');
let content = fs.readFileSync('pages/OrderDetail.tsx', 'utf8');

const targetStr = `            if (!hasPreload) {
                const results = await Promise.allSettled([db.getOrder(orderId, tenantId), db.getProducts(tenantId), db.getTenant(tenantId), db.getGlobalCities()]);
                dataToProcess = results[0].status === 'fulfilled' ? (results[0].value as Order) : null;
                productsToProcess = results[1].status === 'fulfilled' ? (results[1].value as Product[]) : [];
                tenantToProcess = results[2].status === 'fulfilled' ? (results[2].value as Tenant) : null;
                citiesToProcess = results[3].status === 'fulfilled' ? (results[3].value as string[]) : [];
            }`;

const replaceStr = `            // ALWAYS fetch from DB to get the latest accurate details
            const results = await Promise.allSettled([db.getOrder(orderId, tenantId), db.getProducts(tenantId), db.getTenant(tenantId), db.getGlobalCities()]);
            const fetchedOrder = results[0].status === 'fulfilled' ? (results[0].value as Order) : null;
            if (fetchedOrder) dataToProcess = fetchedOrder;
            
            const fetchedProducts = results[1].status === 'fulfilled' ? (results[1].value as Product[]) : [];
            if (fetchedProducts && fetchedProducts.length > 0) productsToProcess = fetchedProducts;
            
            const fetchedTenant = results[2].status === 'fulfilled' ? (results[2].value as Tenant) : null;
            if (fetchedTenant) tenantToProcess = fetchedTenant;
            
            const fetchedCities = results[3].status === 'fulfilled' ? (results[3].value as string[]) : [];
            if (fetchedCities && fetchedCities.length > 0) citiesToProcess = fetchedCities;
`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('pages/OrderDetail.tsx', content);
console.log("Updated OrderDetail to fully connect and fetch from DB");
