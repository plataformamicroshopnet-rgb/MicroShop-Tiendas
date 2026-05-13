const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const cookies = res.headers['set-cookie'];
    console.log("Cookies:", cookies);
    
    if (cookies) {
      const salesReq = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/sales',
        method: 'GET',
        headers: { 'Cookie': cookies[0] }
      }, (salesRes) => {
        let salesData = '';
        salesRes.on('data', (chunk) => { salesData += chunk; });
        salesRes.on('end', () => {
          console.log("Sales data length:", JSON.parse(salesData).sales?.length || salesData);
        });
      });
      salesReq.end();
    } else {
      console.log("Data:", data);
    }
  });
});

req.write(JSON.stringify({ username: 'Carmen', password: 'password123' }));
req.end();
