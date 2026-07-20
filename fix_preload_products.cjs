const fs = require('fs');
let content = fs.readFileSync('pages/OrderDetail.tsx', 'utf8');

const targetStr = `                const pCache = localStorage.getItem('cache_products_' + tenantId);
                if (pCache) setProducts(JSON.parse(pCache).data);
                
                const cCache = localStorage.getItem('cache_cities');
                const cCities = cCache ? JSON.parse(cCache).data : SRI_LANKA_CITIES_FALLBACK;
                setCities(Array.from(new Set(cCities && cCities.length > 0 ? cCities : SRI_LANKA_CITIES_FALLBACK)));
                
                const tCache = localStorage.getItem('cache_tenants');
                if (tCache) {
                    const tenants = JSON.parse(tCache).data;
                    const t = tenants.find((x: any) => x.id === tenantId);
                    if (t) setTenant(t);
                }`;

const replaceStr = `                const pCache = localStorage.getItem('cache_products_' + tenantId);
                if (pCache) setProducts(JSON.parse(pCache).data);
                else db.getProducts(tenantId).then(setProducts).catch(()=>{});
                
                const cCache = localStorage.getItem('cache_cities');
                if (cCache) {
                    const cCities = JSON.parse(cCache).data;
                    setCities(Array.from(new Set(cCities && cCities.length > 0 ? cCities : SRI_LANKA_CITIES_FALLBACK)));
                } else db.getGlobalCities().then(c => setCities(Array.from(new Set(c && c.length > 0 ? c : SRI_LANKA_CITIES_FALLBACK)))).catch(()=>{});
                
                const tCache = localStorage.getItem('cache_tenants');
                if (tCache) {
                    const tenants = JSON.parse(tCache).data;
                    const t = tenants.find((x: any) => x.id === tenantId);
                    if (t) setTenant(t);
                } else db.getTenant(tenantId).then(t => t && setTenant(t)).catch(()=>{});`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('pages/OrderDetail.tsx', content);
console.log("Fixed missing product/tenant cache fallback");
