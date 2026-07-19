const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const searchTarget = `        if (search) {
            query.$or = [
                { id: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { customerPhone: { $regex: search, $options: 'i' } },
                { trackingNumber: { $regex: search, $options: 'i' } }
            ];
        }`;

const searchReplacement = `        if (search) {
            const searchOr = [
                { id: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { customerPhone: { $regex: search, $options: 'i' } },
                { trackingNumber: { $regex: search, $options: 'i' } }
            ];
            
            if (query.$or) {
                const existingOr = query.$or;
                delete query.$or;
                if (query.$and) {
                    query.$and.push({ $or: searchOr });
                } else {
                    query.$and = [
                        { $or: existingOr },
                        { $or: searchOr }
                    ];
                }
            } else if (query.$and) {
                query.$and.push({ $or: searchOr });
            } else {
                query.$or = searchOr;
            }
        }`;

content = content.replace(searchTarget, searchReplacement);
fs.writeFileSync('server.js', content);
