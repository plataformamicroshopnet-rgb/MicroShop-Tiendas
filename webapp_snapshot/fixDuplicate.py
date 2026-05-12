import re

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the block to remove
duplicate_block = """  // Pre-calcular totales
  const grandTotalTiendas = tiendasRules.reduce((acc, rule) => {
    const dataAux = getSalesDataForStoreAndType('Auxiliadora 45', rule.tipoVenta);
    const dataCor = getSalesDataForStoreAndType('Correhuela', rule.tipoVenta);
    const dataVil = getSalesDataForStoreAndType('Villamayor', rule.tipoVenta);
    const dataBej = getSalesDataForStoreAndType('Béjar', rule.tipoVenta);
    const salesTot = dataAux.value + dataCor.value + dataVil.value + dataBej.value;

    const impAux = calculateTiendaImporte(rule, 'Auxiliadora 45', dataAux.value, salesTot);
    const impCor = calculateTiendaImporte(rule, 'Correhuela', dataCor.value, salesTot);
    const impVil = calculateTiendaImporte(rule, 'Villamayor', dataVil.value, salesTot);
    const impBej = calculateTiendaImporte(rule, 'Béjar', dataBej.value, salesTot);
    
    return acc + impAux + impCor + impVil + impBej;
  }, 0);

  const grandTotalO2 = o2Rules.reduce((acc, rule) => {
    const dataO2 = getSalesDataForStoreAndType('O2', rule.tipoVenta);
    return acc + calculateO2Importe(rule, dataO2.value);
  }, 0);

"""

# Because of the accent encoding 'Béjar' vs 'BǸjar', I will use regex
content = re.sub(r"  const grandTotalTiendas = tiendasRules\.reduce\(\(acc, rule\) => \{[\s\S]*?\}, 0\);\n\n  const grandTotalO2 = o2Rules\.reduce\(\(acc, rule\) => \{[\s\S]*?\}, 0\);\n\n", "", content, count=1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Duplicate removed")
