const catalogs = {
  RENT: [
    {
      producto: "Test",
      mensual: "10",
      anual: "120",
      subcategoria: "",
      fabricante: "",
      gama: "",
      validFrom: null,
      validTo: null
    }
  ]
};

fetch('http://localhost:3000/api/catalogs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ catalogs, periodKey: null })
}).then(r => r.json()).then(console.log).catch(console.error);
