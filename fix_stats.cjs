const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const targetStart = "app.get('/api/orders/dashboard-stats'";
const targetEnd = "});\n\napp.get('/api/orders/counts'";

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd) + "});\n".length;

if (startIndex === -1 || endIndex < startIndex) {
    console.error("Could not find the function");
    process.exit(1);
}

const replacement = `app.get('/api/orders/dashboard-stats', async (req, res) => {
    try {
        const { tenantId, startDate, endDate } = req.query;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        
        const db = await getTenantDb(tenantId);
        const col = db.collection('orders');
        
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
        const products = await db.collection('products').find({ tenantId }).toArray();
        const users = await db.collection('users').find({ tenantId }).toArray();
        
        const dailyMap = {};
        const dStart = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
        const dEnd = endDate ? new Date(endDate) : new Date();
        for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
            const slDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
            let formatOptions = { month: 'short', day: 'numeric' };
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
                shipped: 0, delivered: 0, returned: 0, upcomingReturn: 0, revenue: 0, profit: 0, buyingPrice: (p.batches && p.batches.length > 0) ? p.batches[0].buyingPrice : 0 
            };
        });
        
        const teamStats = {};
        users.forEach(u => {
            teamStats[u.username] = { 
                name: u.username, interactions: 0, confirms: 0, rejects: 0, 
                noAnswers: 0, openLeads: 0, rescheduledDelivered: 0, rescheduledReturned: 0 
            };
        });

        const allOrders = await col.find({ tenantId }).toArray();
        
        let deliveredCount = 0, returnedCount = 0, confirmedCount = 0, shippedCount = 0, restockCount = 0;
        let deliveredValue = 0, returnedValue = 0, confirmedValue = 0, shippedValue = 0, restockValue = 0;
        let todayOrders = 0, todayRevenue = 0, todayShippedCount = 0, todayReturnsCount = 0, todayDeliveredCount = 0;

        function getSLDateString(d) {
            return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
        }

        allOrders.forEach(o => {
            const createDate = o.createdAt ? getSLDateString(new Date(o.createdAt)) : null;
            const shipDate = o.shippedAt ? getSLDateString(new Date(o.shippedAt)) : null;
            const confirmDate = o.confirmedAt ? getSLDateString(new Date(o.confirmedAt)) : null;
            const deliverDate = o.deliveredAt ? getSLDateString(new Date(o.deliveredAt)) : null;
            const returnCompletedDate = o.returnCompletedAt ? getSLDateString(new Date(o.returnCompletedAt)) : null;

            const createIsInRange = createDate && createDate >= (startDate || "2000-01-01") && createDate <= (endDate || "2099-12-31");
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
                        productStats[item.productId].revenue += ((item.quantity * (item.price || 0)) || 0);
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
                if (dDate && dailyMap[dDate]) dailyMap[dDate].sales += o.totalAmount || 0;
                
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
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});\n`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync('server.js', content);
console.log("Replaced successfully!");
