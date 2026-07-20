const fs = require('fs');
let content = fs.readFileSync('pages/OrderDetail.tsx', 'utf8');

const targetStr = `  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([db.getOrder(orderId, tenantId), db.getProducts(tenantId), db.getTenant(tenantId), db.getGlobalCities()]);
      const data = results[0].status === 'fulfilled' ? (results[0].value as Order) : null;
      const fetchedProducts = results[1].status === 'fulfilled' ? (results[1].value as Product[]) : [];
      const fetchedTenant = results[2].status === 'fulfilled' ? (results[2].value as Tenant) : null;
      const fetchedCities = results[3].status === 'fulfilled' ? (results[3].value as string[]) : [];`;

const replaceStr = `  const loadData = useCallback(async () => {
    // Optimistic UI for instant load
    const preOrder = localStorage.getItem('pre_order_' + orderId);
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
    }
    
    try {
      const results = await Promise.allSettled([db.getOrder(orderId, tenantId), db.getProducts(tenantId), db.getTenant(tenantId), db.getGlobalCities()]);
      const data = results[0].status === 'fulfilled' ? (results[0].value as Order) : null;
      const fetchedProducts = results[1].status === 'fulfilled' ? (results[1].value as Product[]) : [];
      const fetchedTenant = results[2].status === 'fulfilled' ? (results[2].value as Tenant) : null;
      const fetchedCities = results[3].status === 'fulfilled' ? (results[3].value as string[]) : [];`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('pages/OrderDetail.tsx', content);
console.log("Updated OrderDetail to load instantly");
