const fs = require('fs');
let content = fs.readFileSync('pages/OrderDetail.tsx', 'utf8');

const regex = /const loadData = useCallback\(async \(isReload = false\) => \{[\s\S]*?\}, \[orderId, tenantId, order\]\);/;

const replaceStr = `const hasLoadedRef = useRef(false);
  const loadData = useCallback(async (isReload = false) => {
    let hasPreload = false;
    let dataToProcess = null;
    let productsToProcess = [];
    let tenantToProcess = null;
    let citiesToProcess = [];

    setLoading(true);

    if (!hasLoadedRef.current || isReload) {
        if (!isReload) {
            const preOrder = localStorage.getItem('pre_order_' + orderId);
            if (preOrder) {
                try {
                    const parsed = JSON.parse(preOrder);
                    dataToProcess = parsed;
                    hasPreload = true;
                    
                    const pCache = localStorage.getItem('cache_products_' + tenantId);
                    if (pCache) productsToProcess = JSON.parse(pCache).data;
                    else db.getProducts(tenantId).then(setProducts).catch(()=>{});
                    
                    const cCache = localStorage.getItem('cache_cities');
                    if (cCache) citiesToProcess = JSON.parse(cCache).data;
                    else db.getGlobalCities().then(c => setCities(Array.from(new Set(c && c.length > 0 ? c : SRI_LANKA_CITIES_FALLBACK)))).catch(()=>{});
                    
                    const tCache = localStorage.getItem('cache_tenants');
                    if (tCache) {
                        const tenants = JSON.parse(tCache).data;
                        const t = tenants.find((x: any) => x.id === tenantId);
                        if (t) tenantToProcess = t;
                    } else db.getTenant(tenantId).then(t => t && setTenant(t)).catch(()=>{});
                } catch(e) {}
            }
        }

        try {
            if (!hasPreload) {
                const results = await Promise.allSettled([db.getOrder(orderId, tenantId), db.getProducts(tenantId), db.getTenant(tenantId), db.getGlobalCities()]);
                dataToProcess = results[0].status === 'fulfilled' ? (results[0].value as Order) : null;
                productsToProcess = results[1].status === 'fulfilled' ? (results[1].value as Product[]) : [];
                tenantToProcess = results[2].status === 'fulfilled' ? (results[2].value as Tenant) : null;
                citiesToProcess = results[3].status === 'fulfilled' ? (results[3].value as string[]) : [];
            }

            const uniqueCities = Array.from(new Set(citiesToProcess && citiesToProcess.length > 0 ? citiesToProcess : SRI_LANKA_CITIES_FALLBACK));
            setCities(uniqueCities);

            if (dataToProcess) {
                setOrder(dataToProcess);
                if (productsToProcess.length) setProducts(productsToProcess);
                if (tenantToProcess) setTenant(tenantToProcess);

                db.getCustomerDetailedHistory(dataToProcess.customerPhone, tenantId)
                  .then(h => setCustomerHistory(h.filter(x => x.id !== orderId)))
                  .catch(() => {});

                const initialCity = dataToProcess.customerCity || ''; 
                setCitySearch(initialCity);

                let dateVal = '';
                if (dataToProcess.createdAt) {
                  const dateObj = new Date(dataToProcess.createdAt);
                  if (!isNaN(dateObj.getTime())) {
                    const offset = dateObj.getTimezoneOffset() * 60000;
                    dateVal = (new Date(dateObj.getTime() - offset)).toISOString().slice(0, 16);
                  }
                }
                setEditDate(dateVal);

                const defaultDesc = dataToProcess.parcelDescription && dataToProcess.parcelDescription !== 'Online Order' 
                    ? dataToProcess.parcelDescription 
                    : (dataToProcess.items?.[0]?.name || '');

                setLocalFormData({ 
                  customerName: dataToProcess.customerName || '', 
                  customerPhone: dataToProcess.customerPhone || '', 
                  customerPhone2: dataToProcess.customerPhone2 || '',
                  customerAddress: dataToProcess.customerAddress || '', 
                  customerCity: initialCity, 
                  parcelWeight: dataToProcess.parcelWeight || '1', 
                  parcelDescription: defaultDesc, 
                  trackingNumber: dataToProcess.trackingNumber || '', 
                  createdAt: dateVal,
                  rescheduleNote: dataToProcess.rescheduleNote || '',
                  rescheduledBy: dataToProcess.rescheduledBy || ''
                });
                setItems(dataToProcess.items || []);
                hasLoadedRef.current = true;
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    } else {
        setLoading(false);
    }
  }, [orderId, tenantId]);`;

content = content.replace(regex, replaceStr);

fs.writeFileSync('pages/OrderDetail.tsx', content);
console.log("Fixed loadData function loop");
