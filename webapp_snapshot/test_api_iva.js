const http = require('http');
http.get('http://localhost:3000/api/gastos?grupo=IVA', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);
    if(json.success) {
      const years = new Set(json.data.map(g => g.year));
      console.log('API returned years:', Array.from(years));
    } else {
      console.log('API failed:', json);
    }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
