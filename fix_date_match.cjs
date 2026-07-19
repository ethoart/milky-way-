const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const target = `        if (!query.shippedAt && (startDate || endDate)) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = startDate;
            if (endDate) query.createdAt.$lte = endDate + 'T23:59:59';
        }`;

const replacement = `        if (!query.shippedAt && (startDate || endDate)) {
            const dateMatch = {};
            if (startDate) dateMatch.$gte = startDate;
            if (endDate) dateMatch.$lte = endDate + 'T23:59:59';
            
            // To ensure we get all relevant orders for the dashboard, match any of the activity dates
            if (query.$or) {
                // If there's already an $or (like search), we need to use $and
                const existingOr = query.$or;
                delete query.$or;
                query.$and = [
                    { $or: existingOr },
                    { $or: [ { createdAt: dateMatch }, { shippedAt: dateMatch }, { deliveredAt: dateMatch }, { confirmedAt: dateMatch } ] }
                ];
            } else {
                query.$or = [
                    { createdAt: dateMatch },
                    { shippedAt: dateMatch },
                    { deliveredAt: dateMatch },
                    { confirmedAt: dateMatch }
                ];
            }
        }`;

content = content.replace(target, replacement);
fs.writeFileSync('server.js', content);
