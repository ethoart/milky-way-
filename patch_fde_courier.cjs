const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const target = `app.post('/api/ship-order', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { order, user } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });

        const db = await getTenantDb(tenantId);
        const existing = await db.collection('orders').findOne({ id: order.id, tenantId });
        let updatedOrder = { ...order };

        // Retrieve Tenant Settings for Courier Sync
        const tenant = await db.collection('tenants').findOne({ id: tenantId });
        let trackingResponse = null;

        if (tenant && tenant.settings && tenant.settings.courierMode === 'STANDARD' && tenant.settings.courierApiUrl) {
            try {
                const apiPayload = {
                    API_KEY: tenant.settings.courierApiKey,
                    Client_Id: tenant.settings.courierClientId,
                    Name: order.customerName,
                    ContactNo1: order.customerPhone,
                    ContactNo2: order.customerPhone,
                    Address: order.customerAddress,
                    City: order.customerCity,
                    Weight: "1",
                    Pieces: "1",
                    CODAmount: order.totalAmount,
                    Description: order.items ? order.items.map(i => i.name).join(', ') : "Parcel",
                    ExchangeVal: "0",
                    Remarks: ""
                };
                
                const response = await fetch(tenant.settings.courierApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiPayload)
                });
                
                const data = await response.json();
                
                // Prompt Express returns status 200 for success, >200 for errors
                if (data && data[0] && data[0].WayBillID) {
                    updatedOrder.trackingNumber = data[0].WayBillID;
                    trackingResponse = \`Waybill \${data[0].WayBillID} generated.\`;
                } else if (data && data[0] && data[0].Status) {
                    const statusId = data[0].Status;
                    throw new Error(\`Courier Error \${statusId}: \${FDE_ERRORS[statusId] || 'Unknown'}\`);
                } else {
                    console.log("Courier API returned:", data);
                }
            } catch (err) {
                console.error("Courier API error:", err);
                throw new Error("Courier API Handshake Failed: " + err.message);
            }
        }

        if (existing) {
            updatedOrder = { ...existing, ...updatedOrder, status: 'SHIPPED', shippedAt: new Date().toISOString() };
            if (!updatedOrder.logs) updatedOrder.logs = [];
            updatedOrder.logs.push({ id: \`l-\${Date.now()}\`, message: \`Status Protocol: Order transitioned to SHIPPED. \${trackingResponse || ''}\`, timestamp: new Date().toISOString(), user: user || 'System' });
        }
        await db.collection('orders').updateOne({ id: order.id }, { $set: { ...clean(updatedOrder), tenantId } }, { upsert: true });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});`;

const replacement = `app.post('/api/ship-order', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { order, user } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });

        const db = await getTenantDb(tenantId);
        const existing = await db.collection('orders').findOne({ id: order.id, tenantId });
        let updatedOrder = { ...order };

        const tenant = await db.collection('tenants').findOne({ id: tenantId });
        let trackingResponse = null;

        if (tenant && tenant.settings && tenant.settings.courierApiKey) {
            try {
                const fdeOrderId = order.id.replace(/\\D/g, '').slice(-10) || Math.floor(Math.random() * 1000000000).toString();
                const productNames = order.items && order.items.length > 0 ? order.items.map((i) => i.name).join(' + ') : 'Standard Shipment';
                const hasCustomDescription = order.parcelDescription && order.parcelDescription !== 'Online Order';
                const finalDescription = hasCustomDescription ? order.parcelDescription : productNames;

                const formData = new URLSearchParams();
                formData.append('api_key', tenant.settings.courierApiKey.trim());
                formData.append('client_id', (tenant.settings.courierClientId || '').trim());
                formData.append('order_id', fdeOrderId);
                formData.append('parcel_weight', order.parcelWeight || '1');
                formData.append('parcel_description', finalDescription.slice(0, 50));
                formData.append('recipient_name', order.customerName);
                formData.append('recipient_contact_1', order.customerPhone.replace(/\\D/g, ''));
                
                const phone2 = (order.customerPhone2 || '').replace(/\\D/g, '');
                if (phone2) formData.append('recipient_contact_2', phone2);
                
                formData.append('recipient_address', order.customerAddress);
                formData.append('recipient_city', order.customerCity || '');
                formData.append('amount', Math.round(order.totalAmount).toString());
                formData.append('exchange', '0');

                const targetUrl = tenant.settings.courierMode === 'EXISTING_WAYBILL' 
                    ? 'https://www.fdedomestic.com/api/parcel/existing_waybill_api_v1.php'
                    : 'https://www.fdedomestic.com/api/parcel/new_api_v1.php';
                    
                if (tenant.settings.courierMode === 'EXISTING_WAYBILL') {
                    formData.append('waybill_id', (order.trackingNumber || '').toString());
                }

                const response = await fetch(targetUrl, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData 
                });
                
                const rawText = await response.text();
                let data;
                try {
                    data = JSON.parse(rawText);
                } catch(e) {
                    throw new Error(\`FDE Text Response: \${rawText.slice(0, 100)}\`);
                }
                
                const status = Number(data.status);
                if (status === 200) {
                    updatedOrder.trackingNumber = data.waybill_no || order.trackingNumber;
                    trackingResponse = \`Waybill \${data.waybill_no || 'Assigned'}.\`;
                } else {
                    const errorMsg = FDE_ERRORS[status] || \`FDE Error \${status}: Handshake Refused\`;
                    throw new Error(errorMsg);
                }
            } catch (err) {
                console.error("Courier API error:", err);
                return res.status(400).json({ error: err.message });
            }
        }

        if (existing) {
            updatedOrder = { ...existing, ...updatedOrder, status: 'SHIPPED', shippedAt: new Date().toISOString() };
            if (!updatedOrder.logs) updatedOrder.logs = [];
            updatedOrder.logs.push({ id: \`l-\${Date.now()}\`, message: \`Status Protocol: Order transitioned to SHIPPED. \${trackingResponse || ''}\`, timestamp: new Date().toISOString(), user: user || 'OMS Connector' });
        } else {
            updatedOrder.status = 'SHIPPED';
            updatedOrder.shippedAt = new Date().toISOString();
        }
        await db.collection('orders').updateOne({ id: order.id }, { $set: { ...clean(updatedOrder), tenantId } }, { upsert: true });

        res.json({ success: true, updatedOrder });
    } catch (e) { res.status(500).json({ error: e.message }); }
});`;

// Ensure we ignore whitespace diffs when matching
const esc = (s) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s*');
const regex = new RegExp(esc(target), 'g');
code = code.replace(regex, replacement);
fs.writeFileSync('server.js', code);
console.log("Patched server.js for true FDE Courier");
