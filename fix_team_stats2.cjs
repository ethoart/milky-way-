const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const targetLogic = `            // Team Stats
            if (createIsInRange) {
                const uname = o.createdBy || 'unknown';
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
            if (deliverIsInRange && o.createdBy) {
                if (!teamStats[o.createdBy]) teamStats[o.createdBy] = { name: o.createdBy, interactions: 0, confirms: 0, rejects: 0, noAnswers: 0, openLeads: 0, rescheduledDelivered: 0, rescheduledReturned: 0 };
                teamStats[o.createdBy].rescheduledDelivered++;
            }
            if (returnCompletedIsInRange && o.createdBy) {
                if (!teamStats[o.createdBy]) teamStats[o.createdBy] = { name: o.createdBy, interactions: 0, confirms: 0, rejects: 0, noAnswers: 0, openLeads: 0, rescheduledDelivered: 0, rescheduledReturned: 0 };
                teamStats[o.createdBy].rescheduledReturned++;
            }`;

const newLogic = `            // Team Stats from Logs
            if (o.logs && Array.isArray(o.logs)) {
                // To avoid double counting interactions on the same order, track if user interacted
                const interactedUsers = new Set();
                o.logs.forEach(log => {
                    const uname = log.user;
                    if (!uname) return;
                    if (!teamStats[uname]) {
                        teamStats[uname] = { 
                            name: uname, interactions: 0, confirms: 0, rejects: 0, 
                            noAnswers: 0, openLeads: 0, rescheduledDelivered: 0, rescheduledReturned: 0 
                        };
                    }
                    
                    const logDate = log.timestamp ? new Date(log.timestamp) : new Date(o.createdAt);
                    const logSLDate = getSLDateString(logDate);
                    const logIsInRange = logSLDate >= (startDate || logSLDate) && logSLDate <= (endDate || logSLDate);
                    
                    if (logIsInRange) {
                        if (!interactedUsers.has(uname)) {
                            teamStats[uname].interactions++;
                            interactedUsers.add(uname);
                        }
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

content = content.replace(targetLogic, newLogic);
fs.writeFileSync('server.js', content);
console.log("Team stats logic rewritten using logs!");
