const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const oldCode = `        const allOrders = await col.find({ tenantId }).project({ createdAt: 1, shippedAt: 1, confirmedAt: 1, deliveredAt: 1, returnCompletedAt: 1, status: 1, totalAmount: 1, items: 1, 'logs.message': 1, 'logs.user': 1, 'logs.timestamp': 1 }).toArray();`;

const newCode = `        let query = { tenantId };
        
        if (startDate && endDate) {
            const sDate = new Date(\`\${startDate}T00:00:00+05:30\`).toISOString();
            const eDate = new Date(\`\${endDate}T23:59:59.999+05:30\`).toISOString();
            const tDate = new Date(\`\${today}T00:00:00+05:30\`).toISOString();
            const tEndDate = new Date(\`\${today}T23:59:59.999+05:30\`).toISOString();
            
            query.$or = [
                { createdAt: { $gte: sDate, $lte: eDate } },
                { shippedAt: { $gte: sDate, $lte: eDate } },
                { confirmedAt: { $gte: sDate, $lte: eDate } },
                { deliveredAt: { $gte: sDate, $lte: eDate } },
                { returnCompletedAt: { $gte: sDate, $lte: eDate } },
                { "logs.timestamp": { $gte: sDate, $lte: eDate } },
                { status: { $in: ['RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER', 'RETURN_COMPLETED'] } },
                { createdAt: { $gte: tDate, $lte: tEndDate } },
                { shippedAt: { $gte: tDate, $lte: tEndDate } },
                { deliveredAt: { $gte: tDate, $lte: tEndDate } },
                { returnCompletedAt: { $gte: tDate, $lte: tEndDate } }
            ];
        }

        const allOrders = await col.find(query).project({ createdAt: 1, shippedAt: 1, confirmedAt: 1, deliveredAt: 1, returnCompletedAt: 1, status: 1, totalAmount: 1, items: 1, 'logs.message': 1, 'logs.user': 1, 'logs.timestamp': 1 }).toArray();`;

content = content.replace(oldCode, newCode);
fs.writeFileSync('server.js', content);
console.log("Fixed optimized query");
