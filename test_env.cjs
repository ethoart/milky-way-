const http = require('http');
http.get('http://localhost:3000/api/orders?tenantId=t-1768978337119', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data.substring(0, 200)));
});
