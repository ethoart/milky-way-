const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const oldLogic = `            // Team Stats from Logs
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

const newLogic = `            // Team Stats from Logs
            const userMetricsThisOrder = {};
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
                        
                        if (!userMetricsThisOrder[uname]) {
                            userMetricsThisOrder[uname] = new Set();
                            teamStats[uname].interactions++;
                        }
                        
                        const metrics = userMetricsThisOrder[uname];
                        const msg = log.message || '';
                        
                        if (msg.includes('CONFIRMED') && !metrics.has('confirms')) { teamStats[uname].confirms++; metrics.add('confirms'); }
                        if (msg.includes('REJECTED') && !metrics.has('rejects')) { teamStats[uname].rejects++; metrics.add('rejects'); }
                        if (msg.includes('NO_ANSWER') && !metrics.has('noAnswers')) { teamStats[uname].noAnswers++; metrics.add('noAnswers'); }
                        if ((msg.includes('OPEN_LEAD') || msg.includes('Manual Creation') || msg.includes('System Ingestion')) && !metrics.has('openLeads')) { teamStats[uname].openLeads++; metrics.add('openLeads'); }
                        if (msg.includes('DELIVERED') && !metrics.has('delivered')) { teamStats[uname].rescheduledDelivered++; metrics.add('delivered'); }
                        if (msg.includes('RETURN_COMPLETED') && !metrics.has('returned')) { teamStats[uname].rescheduledReturned++; metrics.add('returned'); }
                    }
                });
            }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('server.js', content);
console.log("Fixed unique metrics per order per user");
