const http = require('http');
http.get('http://localhost:3000/api/orders?tenantId=t-1768978337119&status=ALL', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
        const d = JSON.parse(data);
        const returns = d.data.filter(o => o.status === 'RETURN_COMPLETED');
        console.log("Total orders:", d.data.length);
        console.log("Returns:", returns.length);
        returns.slice(0, 3).forEach(r => {
            console.log("Return order:", r.id, r.returnCompletedAt, r.createdAt);
            console.log("Logs:", r.logs);
        });
    } catch(e) { console.log("Error parsing:", data.substring(0, 200)) }
  });
});
