const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const logsTeamStats = `            // Team Stats from Logs
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

content = content.replace(logsTeamStats, correctTeamStats);

const oldUsersInit = `        const teamStats = {};
        users.forEach(u => {
            teamStats[u.username] = { 
                name: u.username, interactions: 0, confirms: 0, rejects: 0, 
                noAnswers: 0, openLeads: 0, rescheduledDelivered: 0, rescheduledReturned: 0 
            };
        });`;

const newUsersInit = `        const teamStats = {};`;

content = content.replace(oldUsersInit, newUsersInit);

fs.writeFileSync('server.js', content);
console.log("Fixed staff performance matrix!");
