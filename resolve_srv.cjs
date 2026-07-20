const dns = require('dns');
dns.setServers(['8.8.8.8']); // Use Google DNS
dns.resolveSrv('_mongodb._tcp.cluster0.xyj8j.mongodb.net', (err, addresses) => {
    if (err) {
        console.error("SRV Error:", err);
        return;
    }
    console.log("SRV Addresses:", addresses);
    
    // Resolve TXT for auth source etc
    dns.resolveTxt('cluster0.xyj8j.mongodb.net', (err, txt) => {
        if (!err) console.log("TXT:", txt);
    });
});
