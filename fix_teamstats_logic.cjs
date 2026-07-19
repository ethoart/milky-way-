const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const tStatsLogs = `            // Team Stats from Logs
            if (o.logs && Array.isArray(o.logs)) {
                o.logs.forEach(log => {
                    const uname = log.user;
                    if (!uname || uname === 'System' || uname === 'DEV_ADMIN') return;
                    if (!teamStats[uname]) {
                        teamStats[uname] = { 
                            name: uname, interactions: 0, confirms: 0, rejects: 0, 
                            noAnswers: 0, openLeads: 0, rescheduledDelivered: 0, rescheduledReturned: 0 
                        };
                    }
                    
                    const logDate = log.timestamp ? new Date(log.timestamp) : new Date(o.createdAt || new Date());
                    const logSLDate = getSLDateString(logDate);
                    const logIsInRange = logSLDate >= (startDate || logSLDate) && logSLDate <= (endDate || logSLDate);
                    
                    if (logIsInRange) {
                        teamStats[uname].interactions++;
                        const msg = log.message || '';
                        if (msg.includes('CONFIRMED')) teamStats[uname].confirms++;
                        if (msg.includes('REJECTED')) teamStats[uname].rejects++;
                        if (msg.includes('NO_ANSWER')) teamStats[uname].noAnswers++;
                        if (msg.includes('OPEN_LEAD') || msg.includes('Manual Creation') || msg.includes('System Ingestion')) teamStats[uname].openLeads++;
                        if (msg.includes('DELIVERED')) teamStats[uname].rescheduledDelivered++;
                        if (msg.includes('RETURN_COMPLETED')) teamStats[uname].rescheduledReturned++;
                    }
                });
            }`;

const repStatsLogs = `            // Team Stats from Logs
            const interactedUsers = new Set();
            if (o.logs && Array.isArray(o.logs)) {
                o.logs.forEach(log => {
                    const uname = log.user;
                    if (!uname || uname === 'System' || uname === 'DEV_ADMIN') return;
                    
                    const logDate = log.timestamp ? new Date(log.timestamp) : new Date(o.createdAt || new Date());
                    const logSLDate = getSLDateString(logDate);
                    const logIsInRange = logSLDate >= (startDate || logSLDate) && logSLDate <= (endDate || logSLDate);
                    
                    if (logIsInRange) {
                        if (!teamStats[uname]) {
                            teamStats[uname] = { 
                                name: uname, interactions: 0, confirms: 0, rejects: 0, 
                                noAnswers: 0, openLeads: 0, rescheduledDelivered: 0, rescheduledReturned: 0 
                            };
                        }
                        
                        if (!interactedUsers.has(uname)) {
                            teamStats[uname].interactions++;
                            interactedUsers.add(uname);
                        }
                        
                        const msg = log.message || '';
                        if (msg.includes('CONFIRMED')) teamStats[uname].confirms++;
                        if (msg.includes('REJECTED')) teamStats[uname].rejects++;
                        if (msg.includes('NO_ANSWER')) teamStats[uname].noAnswers++;
                        if (msg.includes('OPEN_LEAD') || msg.includes('Manual Creation') || msg.includes('System Ingestion')) teamStats[uname].openLeads++;
                        if (msg.includes('DELIVERED')) teamStats[uname].rescheduledDelivered++;
                        if (msg.includes('RETURN_COMPLETED')) teamStats[uname].rescheduledReturned++;
                    }
                });
            }`;

content = content.replace(tStatsLogs, repStatsLogs);

const returnCheck = `        const stats = {
            deliveredCount, deliveredValue, returnedCount, returnedValue,
            confirmedCount, confirmedValue, shippedCount, shippedValue,
            restockCount, restockValue
        };`;
        
const repReturnCheck = `
        const activeUsers = new Set(users.map(u => u.username));
        Object.keys(teamStats).forEach(uname => {
            if (!activeUsers.has(uname) || teamStats[uname].interactions === 0) {
                delete teamStats[uname];
            }
        });

        const stats = {
            deliveredCount, deliveredValue, returnedCount, returnedValue,
            confirmedCount, confirmedValue, shippedCount, shippedValue,
            restockCount, restockValue
        };`;

content = content.replace(returnCheck, repReturnCheck);

fs.writeFileSync('server.js', content);
console.log("Fixed teamStats logic");
