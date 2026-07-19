const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const correctTeamStats = `            // Team Stats
            if (createIsInRange) {
                const uname = o.openedBy || o.createdBy || 'Unknown';
                if (!teamStats[uname]) {
                    teamStats[uname] = { 
                        name: uname, interactions: 0, confirms: 0, rejects: 0, 
                        noAnswers: 0, openLeads: 0, rescheduledDelivered: 0, rescheduledReturned: 0 
                    };
                }
                teamStats[uname].interactions++;
                if (o.status === 'CONFIRMED') teamStats[uname].confirms++;
                if (o.status === 'REJECTED') teamStats[uname].rejects++;
                if (o.status === 'NO_ANSWER') teamStats[uname].noAnswers++;
                if (o.status === 'OPEN_LEAD') teamStats[uname].openLeads++;
            }

            // Deliveries and returns team stats
            if (deliverIsInRange && o.rescheduledBy) {
                if (!teamStats[o.rescheduledBy]) teamStats[o.rescheduledBy] = { name: o.rescheduledBy, interactions: 0, confirms: 0, rejects: 0, noAnswers: 0, openLeads: 0, rescheduledDelivered: 0, rescheduledReturned: 0 };
                teamStats[o.rescheduledBy].rescheduledDelivered++;
            }
            if (returnCompletedIsInRange && o.rescheduledBy) {
                if (!teamStats[o.rescheduledBy]) teamStats[o.rescheduledBy] = { name: o.rescheduledBy, interactions: 0, confirms: 0, rejects: 0, noAnswers: 0, openLeads: 0, rescheduledDelivered: 0, rescheduledReturned: 0 };
                teamStats[o.rescheduledBy].rescheduledReturned++;
            }`;

const logsTeamStats = `            // Team Stats from Logs
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
                        if (msg.includes('OPEN_LEAD')) teamStats[uname].openLeads++;
                        if (msg.includes('DELIVERED')) teamStats[uname].rescheduledDelivered++;
                        if (msg.includes('RETURN_COMPLETED')) teamStats[uname].rescheduledReturned++;
                    }
                });
            }`;

content = content.replace(correctTeamStats, logsTeamStats);
fs.writeFileSync('server.js', content);
console.log("Fixed team stats using logs");
