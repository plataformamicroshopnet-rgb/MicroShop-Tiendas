const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const rawData = `
2026													
MES	ENERO	FEBRERO	MARZO	ABRIL	MAYO	JUNIO	JULIO	AGOSTO	SEPTIEMBRE	OCTUBRE	NOVIEMBRE	DICIEMBRE	Totales
IVA Móviles	4.860,02 €	5.116,09 €	8.456,29 €	0,00 €	0,00 €	0,00 €	0,00 €	0,00 €	0,00 €	0,00 €	0,00 €	0,00 €	18.432,40 €
IVA a Clientes	10.230,55 €	4.929,90 €	3.415,24 €	0,00 €	0,00 €	0,00 €	0,00 €	0,00 €	0,00 €	0,00 €	0,00 €	0,00 €	18.575,69 €

2025													
MES	ENERO	FEBRERO	MARZO	ABRIL	MAYO	JUNIO	JULIO	AGOSTO	SEPTIEMBRE	OCTUBRE	NOVIEMBRE	DICIEMBRE	Totales
IVA Móviles	5.129,02 €	6.005,40 €	4.937,16 €	7.234,89 €	6.507,99 €	5.962,23 €	5.326,88 €	4.892,40 €	6.427,03 €	5.497,54 €	10.005,10 €	6.849,20 €	74.774,84 €
IVA a Clientes	6.050,18 €	6.351,62 €	5.362,21 €	5.641,91 €	6.630,65 €	4.744,34 €	9.503,28 €	12.070,67 €	3.144,98 €	13.886,44 €	4.806,15 €	5.225,89 €	83.418,32 €

2024													
Mes	ENERO	FEBRERO	MARZO	ABRIL	MAYO	JUNIO	JULIO	AGOSTO	SEPTIEMBRE	OCTUBRE	NOVIEMBRE	DICIEMBRE	Totales
IVA móviles	8.410,89 €	7.213,16 €	4.403,32 €	9.498,50 €	7.560,59 €	8.863,79 €	7.550,59 €	4.745,70 €	6.666,50 €	5.497,54 €	10.005,10 €	6.849,20 €	87.264,88 €
IVA a Clientes	2.599,58 €	4.602,07 €	15.034,82 €	2.989,18 €	4.517,18 €	7.105,43 €	5.694,03 €	9.842,82 €	4.696,63 €	13.886,44 €	4.806,15 €	5.225,89 €	81.000,22 €

2023													
Mes	ENERO	FEBRERO	MARZO	ABRIL	MAYO	JUNIO	JULIO	AGOSTO	SEPTIEMBRE	OCTUBRE	NOVIEMBRE	DICIEMBRE	Totales
IVA móviles	9.872,99 €	7.031,96 €	9.026,09 €	5.680,07 €	10.684,60 €	9.200,01 €	10.356,95 €	7.353,61 €	6.452,67 €	7.438,46 €	14.980,42 €	6.277,24 €	104.355,07 €
IVA a Clientes	3.181,09 €	4.768,32 €	8.154,18 €	5.636,56 €	-1.343,40 €	6.598,29 €	4.924,23 €	10.633,96 €	5.789,45 €	8.831,14 €	2.284,62 €	5.257,58 €	64.716,02 €

2022													
Mes	ENERO	FEBRERO	MARZO	ABRIL	MAYO	JUNIO	JULIO	AGOSTO	SEPTIEMBRE	OCTUBRE	NOVIEMBRE	DICIEMBRE	Totales
IVA móviles	11.861,50 €	12.851,83 €	14.113,69 €	12.396,08 €	13.988,06 €	17.354,89 €	6.197,17 €	10.978,99 €	10.198,56 €	6.901,68 €	10.308,22 €	9.656,97 €	136.807,64 €
IVA a Clientes	2.206,04 €	-1.438,74 €	-4.280,13 €	-1.873,29 €	-3.173,48 €	-6.371,89 €	6.046,69 €	5.390,09 €	2.132,30 €	16.483,91 €	1.218,01 €	4.063,28 €	20.402,79 €

2021													
MES	ENERO	FEBRERO	MARZO	ABRIL	MAYO	JUNIO	JULIO	AGOSTO	SEPTIEMBRE	OCTUBRE	NOVIEMBRE	DICIEMBRE	Totales
IVA Móviles	7.838,17 €	6.661,15 €	8.662,85 €	11.514,07 €	10.312,02 €	13.307,47 €	10.484,39 €	9.961,84 €	12.299,81 €	10.132,74 €	17.162,67 €	17.987,37 €	136.324,55 €
IVA a Clientes	10.753,70 €	10.261,06 €	5.325,83 €	32.711,49 €	3.787,79 €	1.276,38 €	-11.984,09 €	6.212,74 €	-1.434,38 €	-10.594,56 €	1.974,39 €	-4.195,95 €	44.094,40 €

2020													
MES	ENERO	FEBRERO	MARZO	ABRIL	MAYO	JUNIO	JULIO	AGOSTO	SEPTIEMBRE	OCTUBRE	NOVIEMBRE	DICIEMBRE	Totales
IVA Móviles	11.542,03 €	7.407,99 €	3.508,02 €	0,00 €	1.680,84 €	11.573,42 €	11.419,49 €	8.018,41 €	7.291,10 €	9.630,63 €	14.203,46 €	7.660,66 €	93.936,05 €
IVA a Clientes	8.409,96 €	11.674,04 €	14.009,42 €	14.412,19 €	9.448,41 €	4.855,55 €	3.468,74 €	8.456,28 €	4.735,95 €	7.950,46 €	8.566,41 €	9.285,87 €	105.273,28 €

2019													
MES	ENERO	FEBRERO	MARZO	ABRIL	MAYO	JUNIO	JULIO	AGOSTO	SEPTIEMBRE	OCTUBRE	NOVIEMBRE	DICIEMBRE	Totales
IVA Móviles	14.075,53 €	8.420,09 €	11.140,75 €	8.571,75 €	14.362,23 €	9.664,13 €	9.138,34 €	10.972,38 €	12.936,74 €	18.568,82 €	11.627,56 €	8.928,00 €	138.406,32 €
IVA a Clientes	11.623,70 €	4.662,75 €	10.277,90 €	9.619,87 €	8.621,77 €	11.469,63 €	12.287,40 €	12.813,73 €	7.628,56 €	10.787,66 €	12.798,39 €	13.804,20 €	126.395,56 €

2018													
MES	ENERO	FEBRERO	MARZO	ABRIL	MAYO	JUNIO	JULIO	AGOSTO	SEPTIEMBRE	OCTUBRE	NOVIEMBRE	DICIEMBRE	Totales
IVA Móviles	10.678,50 €	10.724,96 €	11.284,47 €	14.627,21 €	12.320,69 €	13.310,62 €	14.364,85 €	9.300,69 €	18.503,88 €	14.134,41 €	11.412,79 €	10.678,50 €	151.341,57 €
IVA a Clientes	16.290,05 €	14.718,04 €	10.230,81 €	11.953,44 €	9.687,81 €	11.682,17 €	12.797,92 €	15.660,33 €	6.945,87 €	13.218,58 €	16.596,86 €	12.562,54 €	152.344,42 €

AÑO 2017													
MES	ENERO	FEBRERO	MARZO	ABRIL	MAYO	JUNIO	JULIO	AGOSTO	SEPTIEMBRE	OCTUBRE	NOVIEMBRE	DICIEMBRE	Totales
IVA Móviles	10.068,35 €	9.567,92 €	9.617,67 €	7.058,91 €	8.569,41 €	7.318,42 €	10.582,07 €	13.837,91 €	13.604,56 €	17.041,82 €	18.292,74 €	17.365,33 €	142.925,11 €
IVA a Clientes	11.496,57 €	7.074,67 €	9.245,89 €	10.752,03 €	21.628,32 €	9.438,81 €	2.970,18 €	12.952,26 €	5.790,67 €	5.780,29 €	8.475,26 €	6.670,00 €	112.274,95 €

AÑO 2016													
MES	ENERO	FEBRERO	MARZO	ABRIL	MAYO	JUNIO	JULIO	AGOSTO	SEPTIEMBRE	OCTUBRE	NOVIEMBRE	DICIEMBRE	Totales
IVA Móviles	13.263,48 €	10.942,73 €	9.426,40 €	12.725,79 €	12.497,75 €	8.576,43 €	7.682,40 €	9.682,83 €	19.991,92 €	9.002,93 €	10.282,87 €	13.506,89 €	137.582,42 €
IVA a Clientes	10.974,54 €	9.064,51 €	9.852,21 €	8.581,61 €	10.551,57 €	13.687,21 €	12.953,66 €	10.537,08 €	393,96 €	10.647,84 €	13.209,56 €		110.453,75 €

AÑO 2015													
MES	ENERO	FEBRERO	MARZO	ABRIL	MAYO	JUNIO	JULIO	AGOSTO	SEPTIEMBRE	OCTUBRE	NOVIEMBRE	DICIEMBRE	Totales
IVA Móviles	12.345,00 €	22.752,00 €	15.669,00 €	20.883,09 €	17.669,12 €	19.526,55 €	15.968,44 €	12.386,30 €	24.282,65 €	17.326,78 €	14.004,79 €	15.855,92 €	208.669,64 €
IVA a Clientes	11.855,14 €	136,66 €	8.538,01 €	1.650,99 €	15.250,90 €	2.455,97 €	13.713,98 €	8.112,42 €	-8.972,86 €	11.493,90 €	16.997,19 €	15.449,31 €	96.681,61 €
`;

async function main() {
  const lines = rawData.split('\n').map(l => l.trim()).filter(l => l);
  const items = [];
  
  let currentYear = 2026;
  
  for (const line of lines) {
    if (line.match(/20\d\d/)) {
      const match = line.match(/(20\d\d)/);
      if (match) currentYear = parseInt(match[1]);
      continue;
    }
    if (line.toLowerCase().startsWith('mes')) continue;
    
    if (line.toLowerCase().startsWith('iva m') || line.toLowerCase().startsWith('iva a')) {
      const cols = line.split('\t');
      const concepto = cols[0].trim();
      
      for (let m = 1; m <= 12; m++) {
        let valStr = cols[m] || '0';
        valStr = valStr.replace('€', '').trim();
        valStr = valStr.replace(/\./g, '').replace(',', '.');
        const val = parseFloat(valStr) || 0;
        
        items.push({
          year: currentYear,
          month: m,
          grupo: 'IVA',
          concepto: concepto === 'IVA móviles' ? 'IVA Móviles' : concepto,
          importe_c: 0,
          importe_r: 0,
          importe_dif: 0,
          importe_total: val
        });
      }
    }
  }

  await prisma.$transaction(
    items.map(item => 
      prisma.gastoMensual.upsert({
        where: { year_month_grupo_concepto: { year: item.year, month: item.month, grupo: item.grupo, concepto: item.concepto } },
        update: { importe_total: item.importe_total },
        create: item
      })
    )
  );
  console.log(`Imported ${items.length} records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
