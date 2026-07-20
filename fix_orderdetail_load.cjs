const fs = require('fs');
let content = fs.readFileSync('pages/OrderDetail.tsx', 'utf8');

const startTarget = `  const loadData = useCallback(async () => {
    // Optimistic UI for instant load
    let hasPreload = false;
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
    }
    
    try {
      let data = order;
      let fetchedProducts = products;
      let fetchedTenant = tenant;
      let fetchedCities = cities;

      if (!order && !hasPreload) {
          const results = await Promise.allSettled([db.getOrder(orderId, tenantId), db.getProducts(tenantId), db.getTenant(tenantId), db.getGlobalCities()]);
          data = results[0].status === 'fulfilled' ? (results[0].value as Order) : null;
          fetchedProducts = results[1].status === 'fulfilled' ? (results[1].value as Product[]) : [];
          fetchedTenant = results[2].status === 'fulfilled' ? (results[2].value as Tenant) : null;
          fetchedCities = results[3].status === 'fulfilled' ? (results[3].value as string[]) : [];
      }
      
      const uniqueCities = Array.from(new Set(fetchedCities && fetchedCities.length > 0 ? fetchedCities : SRI_LANKA_CITIES_FALLBACK));
      setCities(uniqueCities);

      if (data && !hasPreload) {
        setOrder(data);
        setProducts(fetchedProducts);
        setTenant(fetchedTenant || null);
        db.getCustomerDetailedHistory(data.customerPhone, tenantId).then(h => setCustomerHistory(h.filter(x => x.id !== orderId))).catch(() => {});

        const initialCity = data.customerCity || ''; 
        setCitySearch(initialCity);

        let dateVal = '';
        if (data.createdAt) {
          const dateObj = new Date(data.createdAt);
          if (!isNaN(dateObj.getTime())) {
            const offset = dateObj.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(dateObj.getTime() - offset)).toISOString().slice(0, 16);
            dateVal = localISOTime;
          }
        }
        setEditDate(dateVal);

        // INTELLIGENT DEFAULT: Use item name if description is missing or generic
        const defaultDesc = data.parcelDescription && data.parcelDescription !== 'Online Order' 
            ? data.parcelDescription 
            : (data.items?.[0]?.name || '');

        setLocalFormData({ 
          customerName: data.customerName || '', 
          customerPhone: data.customerPhone || '', 
          customerPhone2: data.customerPhone2 || '',
          customerAddress: data.customerAddress || '', 
          customerCity: initialCity, 
          parcelWeight: data.parcelWeight || '1', 
          parcelDescription: defaultDesc, 
          trackingNumber: data.trackingNumber || '', 
          createdAt: dateVal,
          rescheduleNote: data.rescheduleNote || '',
          rescheduledBy: data.rescheduledBy || ''
        });
        setItems(data.items || []);
      } else if (hasPreload) {
          // If preloaded, we still want to ensure history is fetched if it wasn't in cache
          const parsed = JSON.parse(localStorage.getItem('pre_order_' + orderId) || '{}');
          if (parsed.customerPhone) {
              db.getCustomerDetailedHistory(parsed.customerPhone, tenantId).then(h => setCustomerHistory(h.filter(x => x.id !== orderId))).catch(() => {});
          }
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!hasPreload) setLoading(false);
    }`;

const replaceContent = `  const loadData = useCallback(async (isReload = false) => {
    let hasPreload = false;
    if (!order && !isReload) {
        const preOrder = localStorage.getItem('pre_order_' + orderId);
        if (preOrder) {
            try {
                const data = JSON.parse(preOrder);
                setOrder(data);
                hasPreload = true;
                
                const pCache = localStorage.getItem('cache_products_' + tenantId);
                if (pCache) setProducts(JSON.parse(pCache).data);
                
                const cCache = localStorage.getItem('cache_cities');
                const cCities = cCache ? JSON.parse(cCache).data : SRI_LANKA_CITIES_FALLBACK;
                setCities(Array.from(new Set(cCities && cCities.length > 0 ? cCities : SRI_LANKA_CITIES_FALLBACK)));
                
                const tCache = localStorage.getItem('cache_tenants');
                if (tCache) {
                    const tenants = JSON.parse(tCache).data;
                    const t = tenants.find((x: any) => x.id === tenantId);
                    if (t) setTenant(t);
                }
                
                if (data.customerPhone) {
                    const histCache = localStorage.getItem('cache_hist_' + data.customerPhone);
                    if (histCache) {
                        setCustomerHistory(JSON.parse(histCache).data.filter((x: any) => x.id !== orderId));
                    } else {
                        db.getCustomerDetailedHistory(data.customerPhone, tenantId).then(h => setCustomerHistory(h.filter(x => x.id !== orderId))).catch(() => {});
                    }
                }
                
                const initialCity = data.customerCity || ''; 
                setCitySearch(initialCity);
                let dateVal = '';
                if (data.createdAt) {
                  const dateObj = new Date(data.createdAt);
                  if (!isNaN(dateObj.getTime())) {
                    const offset = dateObj.getTimezoneOffset() * 60000;
                    dateVal = (new Date(dateObj.getTime() - offset)).toISOString().slice(0, 16);
                  }
                }
                setEditDate(dateVal);
                const defaultDesc = data.parcelDescription && data.parcelDescription !== 'Online Order' ? data.parcelDescription : (data.items?.[0]?.name || '');
                setLocalFormData({ 
                  customerName: data.customerName || '', customerPhone: data.customerPhone || '', customerPhone2: data.customerPhone2 || '',
                  customerAddress: data.customerAddress || '', customerCity: initialCity, parcelWeight: data.parcelWeight || '1', 
                  parcelDescription: defaultDesc, trackingNumber: data.trackingNumber || '', createdAt: dateVal,
                  rescheduleNote: data.rescheduleNote || '', rescheduledBy: data.rescheduledBy || ''
                });
                setItems(data.items || []);
                setLoading(false);
            } catch(e) {}
        }
    }
    
    if (hasPreload) return; // skip network fetch if successfully preloaded on mount

    setLoading(true);
    try {
      const results = await Promise.allSettled([db.getOrder(orderId, tenantId), db.getProducts(tenantId), db.getTenant(tenantId), db.getGlobalCities()]);
      const data = results[0].status === 'fulfilled' ? (results[0].value as Order) : null;
      const fetchedProducts = results[1].status === 'fulfilled' ? (results[1].value as Product[]) : [];
      const fetchedTenant = results[2].status === 'fulfilled' ? (results[2].value as Tenant) : null;
      const fetchedCities = results[3].status === 'fulfilled' ? (results[3].value as string[]) : [];
      
      const uniqueCities = Array.from(new Set(fetchedCities && fetchedCities.length > 0 ? fetchedCities : SRI_LANKA_CITIES_FALLBACK));
      setCities(uniqueCities);

      if (data) {
        setOrder(data);
        setProducts(fetchedProducts);
        setTenant(fetchedTenant || null);
        db.getCustomerDetailedHistory(data.customerPhone, tenantId).then(h => setCustomerHistory(h.filter(x => x.id !== orderId))).catch(() => {});

        const initialCity = data.customerCity || ''; 
        setCitySearch(initialCity);

        let dateVal = '';
        if (data.createdAt) {
          const dateObj = new Date(data.createdAt);
          if (!isNaN(dateObj.getTime())) {
            const offset = dateObj.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(dateObj.getTime() - offset)).toISOString().slice(0, 16);
            dateVal = localISOTime;
          }
        }
        setEditDate(dateVal);

        const defaultDesc = data.parcelDescription && data.parcelDescription !== 'Online Order' 
            ? data.parcelDescription : (data.items?.[0]?.name || '');

        setLocalFormData({ 
          customerName: data.customerName || '', customerPhone: data.customerPhone || '', customerPhone2: data.customerPhone2 || '',
          customerAddress: data.customerAddress || '', customerCity: initialCity, parcelWeight: data.parcelWeight || '1', 
          parcelDescription: defaultDesc, trackingNumber: data.trackingNumber || '', createdAt: dateVal,
          rescheduleNote: data.rescheduleNote || '', rescheduledBy: data.rescheduledBy || ''
        });
        setItems(data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }`;

content = content.replace(startTarget, replaceContent);
content = content.replace("loadData();", "loadData(true);");
content = content.replace("useEffect(() => { loadData(true); }, [loadData]);", "useEffect(() => { loadData(false); }, [loadData]);");
content = content.replace("() => loadData(true)", "() => loadData(true)");
content = content.replace("loadData(true)", "loadData(true)"); // making sure it is properly replaced where loadData() was

fs.writeFileSync('pages/OrderDetail.tsx', content);
console.log("Fixed loadData logic");
