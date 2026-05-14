const http = require('http');
http.get('http://localhost:3000/api/gastos?grupo=IVA', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);
    if(json.success) {
      console.log('Total API records:', json.data.length);
      const ivaMoviles = json.data.filter(g => g.concepto === 'IVA Móviles');
      console.log('IVA Moviles records:', ivaMoviles.length);
      const years = new Set(ivaMoviles.map(g => g.year));
      console.log('IVA Moviles years:', Array.from(years));
    }
  });
});
