const excelText = `"MOVISTAR MAX"\t"miMovistar BASE"\t"Movistar+\nFicción Total con netflix Estándar\nFutbol Total"\t10\t1
"MOVISTAR MAX"\t"miMovistar BASE"\t"Movistar+\nFicción Total con netflix Estándar\nFutbol Total"\t15\t1`;

const updatedItems = [
  { id: '1', subcategoria: 'MOVISTAR MAX', gama: 'miMovistar BASE', producto: 'Movistar+\nFicción Total con netflix Estándar\nFutbol Total', validFrom: null, validTo: null }
];

const normalize = (s) => (s || '').replace(/\s+/g, '').toLowerCase();

const lines = excelText.split('\n');
const excelData = [];
lines.forEach(line => {
  const parts = line.split('\t').map(p => p.trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n'));
  
  if (!parts[0] && !parts[1] && parts[2] && excelData.length > 0) {
    excelData[excelData.length - 1].producto += '\n' + parts[2];
  } else {
    excelData.push({
      subcategoria: parts[0],
      gama: parts[1],
      producto: parts[2],
      comision: parts[3]
    });
  }
});

excelData.forEach(row => {
  const pNameNorm = normalize(row.producto);
  const rowDesde = '';

  let matchIndex = updatedItems.findIndex(it => 
    normalize(it.producto) === pNameNorm && 
    (it.validFrom || '').trim() === rowDesde &&
    normalize(it.subcategoria) === normalize(row.subcategoria) &&
    normalize(it.gama) === normalize(row.gama)
  );

  if (matchIndex === -1) {
    matchIndex = updatedItems.findIndex(it => {
      const dbName = normalize(it.producto);
      return (dbName.includes(pNameNorm) || pNameNorm.includes(dbName)) &&
        normalize(it.subcategoria) === normalize(row.subcategoria) &&
        normalize(it.gama) === normalize(row.gama);
    });
  }

  if (matchIndex >= 0) {
    updatedItems[matchIndex].comision = row.comision;
  } else {
    updatedItems.push({
      id: 'new',
      subcategoria: row.subcategoria,
      gama: row.gama,
      producto: row.producto,
      validFrom: '',
      comision: row.comision
    });
  }
});

console.log("Result items length:", updatedItems.length);
console.log(updatedItems);
