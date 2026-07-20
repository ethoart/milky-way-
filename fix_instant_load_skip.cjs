const fs = require('fs');
let content = fs.readFileSync('pages/OrderDetail.tsx', 'utf8');

const targetStr = `    try {
      const results = await Promise.allSettled([db.getOrder(orderId, tenantId), db.getProducts(tenantId), db.getTenant(tenantId), db.getGlobalCities()]);
      const data = results[0].status === 'fulfilled' ? (results[0].value as Order) : null;
      const fetchedProducts = results[1].status === 'fulfilled' ? (results[1].value as Product[]) : [];
      const fetchedTenant = results[2].status === 'fulfilled' ? (results[2].value as Tenant) : null;
      const fetchedCities = results[3].status === 'fulfilled' ? (results[3].value as string[]) : [];`;

const replaceStr = `    try {
      let data = order;
      let fetchedProducts = products;
      let fetchedTenant = tenant;
      let fetchedCities = cities;

      if (!order) {
          const results = await Promise.allSettled([db.getOrder(orderId, tenantId), db.getProducts(tenantId), db.getTenant(tenantId), db.getGlobalCities()]);
          data = results[0].status === 'fulfilled' ? (results[0].value as Order) : null;
          fetchedProducts = results[1].status === 'fulfilled' ? (results[1].value as Product[]) : [];
          fetchedTenant = results[2].status === 'fulfilled' ? (results[2].value as Tenant) : null;
          fetchedCities = results[3].status === 'fulfilled' ? (results[3].value as string[]) : [];
      }`;

content = content.replace(targetStr, replaceStr);

const initTarget = `const preOrder = localStorage.getItem('pre_order_' + orderId);
    if (preOrder && !order) {
        try {
            const parsed = JSON.parse(preOrder);
            setOrder(parsed);
            setLoading(false);
            
            // Also try to get products & cities if cached
            const pCache = localStorage.getItem('cache_products_' + tenantId);
            if (pCache) setProducts(JSON.parse(pCache).data);
            
            const cCache = localStorage.getItem('cache_cities');
            if (cCache) setCities(JSON.parse(cCache).data);
        } catch(e) {}
    } else if (!order) {
        setLoading(true);
    }`;

const initReplace = `let hasPreload = false;
    const preOrder = localStorage.getItem('pre_order_' + orderId);
    if (preOrder && !order) {
        try {
            const parsed = JSON.parse(preOrder);
            setOrder(parsed);
            setLoading(false);
            hasPreload = true;
            
            // Also try to get products & cities if cached
            const pCache = localStorage.getItem('cache_products_' + tenantId);
            if (pCache) setProducts(JSON.parse(pCache).data);
            
            const cCache = localStorage.getItem('cache_cities');
            if (cCache) setCities(JSON.parse(cCache).data);
            
            const tCache = localStorage.getItem('cache_tenants');
            if (tCache) {
                const tenants = JSON.parse(tCache).data;
                const t = tenants.find((x: any) => x.id === tenantId);
                if (t) setTenant(t);
            }
            
            if (parsed.customerPhone) {
                const histCache = localStorage.getItem('cache_hist_' + parsed.customerPhone);
                if (histCache) {
                    setCustomerHistory(JSON.parse(histCache).data.filter((x: any) => x.id !== orderId));
                }
            }
            setCitySearch(parsed.customerCity || '');
        } catch(e) {}
    } else if (!order) {
        setLoading(true);
    }`;

content = content.replace(initTarget, initReplace);

const dataTarget = `      if (data) {
        setOrder(data);
        setProducts(fetchedProducts);
        setTenant(fetchedTenant || null);`;

const dataReplace = `      if (data && !hasPreload) {
        setOrder(data);
        setProducts(fetchedProducts);
        setTenant(fetchedTenant || null);`;

content = content.replace(dataTarget, dataReplace);

fs.writeFileSync('pages/OrderDetail.tsx', content);
console.log("Updated OrderDetail to fully skip network if preloaded");
