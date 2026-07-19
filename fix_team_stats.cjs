const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const oldTeamLogic = `
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
            if (returnCompletedIsInRange && o.createdBy && teamStats[o.createdBy]) teamStats[o.createdBy].rescheduledReturned++;`;

const newTeamLogic = `
            // Team Stats
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

content = content.replace(oldTeamLogic, newTeamLogic);
fs.writeFileSync('server.js', content);
console.log("Team stats logic fixed");
