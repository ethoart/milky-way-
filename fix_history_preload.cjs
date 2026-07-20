const fs = require('fs');
let content = fs.readFileSync('pages/OrderDetail.tsx', 'utf8');

const targetStr = `      if (data && !hasPreload) {
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
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!hasPreload) setLoading(false);
    }
  }, [orderId, tenantId, order]);`;

const replaceStr = `      if (data && !hasPreload) {
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
    }
  }, [orderId, tenantId, order]);`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('pages/OrderDetail.tsx', content);
console.log("Updated OrderDetail to fetch history even if preloaded");
