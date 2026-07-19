const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const target = `        // Global stats (all time or date filtered)
        const pipeline = [
            { $match: dateMatch },
            { $group: { 
                 _id: "$status", 
                 count: { $sum: 1 },
                value: { $sum: "$totalAmount" } 
             } }
        ];
        const results = await col.aggregate(pipeline).toArray();
        
        const stats = {
          deliveredCount: 0, deliveredValue: 0,
          returnedCount: 0, returnedValue: 0,
          confirmedCount: 0, confirmedValue: 0,
          shippedCount: 0, shippedValue: 0,
          restockCount: 0, restockValue: 0
        };
        results.forEach(r => {
            if (r._id === 'DELIVERED') { stats.deliveredCount = r.count; stats.deliveredValue = r.value; }
            if (['RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER', 'RETURN_COMPLETED'].includes(r._id)) { 
                stats.returnedCount += r.count; stats.returnedValue += r.value; 
            }
            if (r._id === 'CONFIRMED') { stats.confirmedCount = r.count; stats.confirmedValue = r.value; }
            if (r._id === 'SHIPPED') { stats.shippedCount = r.count; stats.shippedValue = r.value; }
            if (r._id === 'RETURN_COMPLETED') { stats.restockCount = r.count; stats.restockValue = r.value; }
        });

        res.json({ stats, inventory: { totalCount: 0, costValue: 0, retailValue: 0 }, dailyMap: {}, productStats: {}, teamStats: {}, todayRevenue: 0, todayDeliveredCount: 0, todayShippedCount: 0, todayReturnsCount: 0 });`;

const replacement = `
        const products = await db.collection('products').find({ tenantId }).toArray();
        const users = await db.collection('users').find({ tenantId }).toArray();

        // Get SL Date String
        const getSLDateString = (dateObj) => {
            if (!dateObj) return null;
            return new Intl.DateTimeFormat('en-CA', { 
                timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' 
            }).format(dateObj);
        };
        
        const getReturnCompletionDate = (o) => {
            if (o.status === 'RETURN_COMPLETED') {
                const completedLog = (o.history || []).find(h => h.status === 'RETURN_COMPLETED');
                if (completedLog) return completedLog.timestamp;
                return o.updatedAt || o.createdAt;
            }
            return null;
        };

        const today = getSLDateString(new Date());
        const dStart = new Date(startDate || today);
        const dEnd = new Date(endDate || today);
        
        const dailyMap = {};
        for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
            const slDate = getSLDateString(d);
            const formatOptions = { month: 'short', day: 'numeric' };
            if (dStart.getFullYear() !== dEnd.getFullYear() || !startDate) {
                formatOptions.year = '2-digit';
            }
            dailyMap[slDate] = { 
                date: d.toLocaleDateString('en-US', formatOptions), 
                monthKey: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                sales: 0, 
                shipped: 0 
            };
        }

        let inventoryTotalCount = 0;
        let inventoryCostValue = 0;
        let inventoryRetailValue = 0;
        const productStats = {};
        products.forEach(p => {
            let pStock = 0;
            (p.batches || []).forEach(b => {
                pStock += b.quantity;
                inventoryCostValue += (b.quantity * (b.buyingPrice || 0));
            });
            inventoryTotalCount += pStock;
            inventoryRetailValue += (pStock * (p.price || 0));
            productStats[p.id] = { 
                sku: p.sku, name: p.name, salesCount: 0, confirmed: 0, 
                shipped: 0, delivered: 0, returned: 0, upcomingReturn: 0, revenue: 0, profit: 0 
            };
        });

        const teamStats = {};
        users.forEach(u => {
            teamStats[u.username] = { 
                name: u.username, interactions: 0, confirms: 0, rejects: 0, 
                noAnswers: 0, openLeads: 0, rescheduledDelivered: 0, rescheduledReturned: 0 
            };
        });

        // Query all orders that might fall into the range for any of their activity dates
        const allOrders = await col.find({ tenantId }).toArray();
        
        let deliveredCount = 0, returnedCount = 0, confirmedCount = 0, shippedCount = 0, restockCount = 0;
        let deliveredValue = 0, returnedValue = 0, confirmedValue = 0, shippedValue = 0, restockValue = 0;
        let todayOrders = 0, todayRevenue = 0, todayShippedCount = 0, todayReturnsCount = 0, todayDeliveredCount = 0;

        allOrders.forEach(o => {
            const createDate = getSLDateString(new Date(o.createdAt));
            const shipDate = o.shippedAt ? getSLDateString(new Date(o.shippedAt)) : null;
            const confirmDate = o.confirmedAt ? getSLDateString(new Date(o.confirmedAt)) : null;
            const deliverDate = o.deliveredAt ? getSLDateString(new Date(o.deliveredAt)) : null;
            const returnDateRaw = getReturnCompletionDate(o);
            const returnCompletedDate = returnDateRaw ? getSLDateString(new Date(returnDateRaw)) : null;

            const createIsInRange = createDate >= (startDate || "2000-01-01") && createDate <= (endDate || "2099-12-31");
            const shipIsInRange = shipDate && shipDate >= (startDate || "2000-01-01") && shipDate <= (endDate || "2099-12-31");
            const confirmIsInRange = confirmDate && confirmDate >= (startDate || "2000-01-01") && confirmDate <= (endDate || "2099-12-31");
            const deliverIsInRange = deliverDate && deliverDate >= (startDate || "2000-01-01") && deliverDate <= (endDate || "2099-12-31");
            const returnCompletedIsInRange = returnCompletedDate && returnCompletedDate >= (startDate || "2000-01-01") && returnCompletedDate <= (endDate || "2099-12-31");

            // Today Snapshots
            if (createDate === today) todayOrders++;
            if (shipDate === today) todayShippedCount++;
            
            if (o.status === 'DELIVERED') {
                if (deliverDate === today || (!deliverDate && shipDate === today)) {
                    todayDeliveredCount++;
                    todayRevenue += o.totalAmount || 0;
                }
            }
            if (o.status === 'RETURN_COMPLETED' && returnCompletedDate === today) {
                todayReturnsCount++;
            }

            // Sales / Leads based on create date
            if (createIsInRange) {
                (o.items || []).forEach(item => {
                    if (productStats[item.productId]) {
                        productStats[item.productId].salesCount += item.quantity;
                        productStats[item.productId].revenue += ((item.quantity * item.price) || 0);
                    }
                });
            }

            // Confirmed
            if (confirmIsInRange || (!o.confirmedAt && createIsInRange && o.status === 'CONFIRMED')) {
                confirmedCount++;
                confirmedValue += o.totalAmount || 0;
                (o.items || []).forEach(item => {
                    if (productStats[item.productId]) productStats[item.productId].confirmed += item.quantity;
                });
            }

            // Delivered
            if (deliverIsInRange || (!o.deliveredAt && o.status === 'DELIVERED' && shipIsInRange)) {
                deliveredCount++;
                deliveredValue += o.totalAmount || 0;
                const dDate = deliverDate || shipDate;
                if (dailyMap[dDate]) dailyMap[dDate].sales += o.totalAmount || 0;
                
                (o.items || []).forEach(item => {
                    if (productStats[item.productId]) productStats[item.productId].delivered += item.quantity;
                });
            }

            // Shipped
            if (shipIsInRange) {
                shippedCount++;
                shippedValue += o.totalAmount || 0;
                if (dailyMap[shipDate]) dailyMap[shipDate].shipped += o.totalAmount || 0;
                (o.items || []).forEach(item => {
                    if (productStats[item.productId]) productStats[item.productId].shipped += item.quantity;
                });
            }

            // Returned (overall) - if it is currently in a returned state and was created/shipped in range
            if (['RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER', 'RETURN_COMPLETED'].includes(o.status)) {
                if (createIsInRange || shipIsInRange) {
                    returnedCount++;
                    returnedValue += o.totalAmount || 0;
                }
            }

            // Return Completed (Restock)
            if (o.status === 'RETURN_COMPLETED' && returnCompletedIsInRange) {
                restockCount++;
                restockValue += o.totalAmount || 0;
                (o.items || []).forEach(item => {
                    if (productStats[item.productId]) productStats[item.productId].returned += item.quantity;
                });
            }
            
            // Upcoming Returns
            if (['RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER'].includes(o.status)) {
                 (o.items || []).forEach(item => {
                    if (productStats[item.productId]) productStats[item.productId].upcomingReturn += item.quantity;
                });
            }

            // Team Stats
            if (createIsInRange) {
                const uname = o.createdBy || 'unknown';
                if (teamStats[uname]) {
                    teamStats[uname].interactions++;
                    if (o.status === 'CONFIRMED') teamStats[uname].confirms++;
                    if (o.status === 'REJECTED') teamStats[uname].rejects++;
                    if (o.status === 'NO_ANSWER') teamStats[uname].noAnswers++;
                    if (o.status === 'OPEN_LEAD') teamStats[uname].openLeads++;
                }
            }
            // Deliveries and returns team stats
            if (deliverIsInRange && o.createdBy && teamStats[o.createdBy]) teamStats[o.createdBy].rescheduledDelivered++;
            if (returnCompletedIsInRange && o.createdBy && teamStats[o.createdBy]) teamStats[o.createdBy].rescheduledReturned++;
        });

        const stats = {
            deliveredCount, deliveredValue, returnedCount, returnedValue,
            confirmedCount, confirmedValue, shippedCount, shippedValue,
            restockCount, restockValue
        };
        
        res.json({ 
            stats, 
            inventory: { totalCount: inventoryTotalCount, costValue: inventoryCostValue, retailValue: inventoryRetailValue }, 
            dailyMap, 
            productStats, 
            teamStats, 
            todayRevenue, todayDeliveredCount, todayShippedCount, todayReturnsCount, todayOrders 
        });`;

content = content.replace(target, replacement);
fs.writeFileSync('server.js', content);
console.log("Server API updated");
