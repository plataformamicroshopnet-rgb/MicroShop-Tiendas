import re

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# TIENDAS RULES
# Add logic to calculate active tramo
old_tiendas_logic = """                const salesBej = dataBej.value;
                const salesTot = salesAux + salesCor + salesVil + salesBej;

                const impAux = calculateTiendaImporte(rule, 'Auxiliadora 45', salesAux);"""
new_tiendas_logic = """                const salesBej = dataBej.value;
                const salesTot = salesAux + salesCor + salesVil + salesBej;
                
                const obj1Target = rule.obj1Type === 'global' ? parseNumber(rule.obj1Global) : 0;
                const obj2Target = rule.obj2Type === 'global' ? parseNumber(rule.obj2Global) : 0;
                let activeTramo = 0;
                if (obj2Target > 0 && salesTot >= obj2Target) activeTramo = 2;
                else if (obj1Target > 0 && salesTot >= obj1Target) activeTramo = 1;

                const impAux = calculateTiendaImporte(rule, 'Auxiliadora 45', salesAux);"""
content = content.replace(old_tiendas_logic, new_tiendas_logic)

# Apply style to Importe 1 input
old_importe1 = """<td style={{ padding: 4 }}><input value={rule.importe1} onChange={e => { const r = [...tiendasRules]; r[idx].importe1 = e.target.value; setTiendasRules(r); }} className="form-input" style={{ width: 60 }} placeholder="Ej: 20%" /></td>"""
new_importe1 = """<td style={{ padding: 4 }}><input value={rule.importe1} onChange={e => { const r = [...tiendasRules]; r[idx].importe1 = e.target.value; setTiendasRules(r); }} className="form-input" style={{ width: 60, backgroundColor: activeTramo === 1 ? '#dcfce7' : '', color: activeTramo === 1 ? '#166534' : '', fontWeight: activeTramo === 1 ? 'bold' : 'normal', borderColor: activeTramo === 1 ? '#22c55e' : '' }} placeholder="Ej: 20%" /></td>"""
content = content.replace(old_importe1, new_importe1)

# Apply style to Importe 2 input
old_importe2 = """<td style={{ padding: 4 }}><input value={rule.importe2} onChange={e => { const r = [...tiendasRules]; r[idx].importe2 = e.target.value; setTiendasRules(r); }} className="form-input" style={{ width: 60 }} placeholder="Ej: 30%" /></td>"""
new_importe2 = """<td style={{ padding: 4 }}><input value={rule.importe2} onChange={e => { const r = [...tiendasRules]; r[idx].importe2 = e.target.value; setTiendasRules(r); }} className="form-input" style={{ width: 60, backgroundColor: activeTramo === 2 ? '#dcfce7' : '', color: activeTramo === 2 ? '#166534' : '', fontWeight: activeTramo === 2 ? 'bold' : 'normal', borderColor: activeTramo === 2 ? '#22c55e' : '' }} placeholder="Ej: 30%" /></td>"""
content = content.replace(old_importe2, new_importe2)


# O2 RULES
# Add logic to calculate active tramo for O2
old_o2_logic = """                const dataO2 = getSalesDataForStoreAndType('O2', rule.tipoVenta);
                const totalSales = dataO2.value;
                const totalImporte = calculateO2Importe(rule, totalSales);"""
new_o2_logic = """                const dataO2 = getSalesDataForStoreAndType('O2', rule.tipoVenta);
                const totalSales = dataO2.value;
                const totalImporte = calculateO2Importe(rule, totalSales);
                let highestTramoKey = '';
                for (const tramo of [...TRAMOS_MES].reverse()) {
                  if (totalSales >= tramo.min) {
                    highestTramoKey = tramo.key;
                    break;
                  }
                }"""
content = content.replace(old_o2_logic, new_o2_logic)

# Apply style to O2 inputs
old_o2_input = """<input value={rule.tramosMes?.[t.key] || ''} onChange={e => { const r = [...o2Rules]; r[idx].tramosMes = { ...(r[idx].tramosMes || {}), [t.key]: e.target.value }; setO2Rules(r); }} className="form-input" style={{ width: 60 }} placeholder="€" />"""
new_o2_input = """<input value={rule.tramosMes?.[t.key] || ''} onChange={e => { const r = [...o2Rules]; r[idx].tramosMes = { ...(r[idx].tramosMes || {}), [t.key]: e.target.value }; setO2Rules(r); }} className="form-input" style={{ width: 60, backgroundColor: highestTramoKey === t.key ? '#dcfce7' : '', color: highestTramoKey === t.key ? '#166534' : '', fontWeight: highestTramoKey === t.key ? 'bold' : 'normal', borderColor: highestTramoKey === t.key ? '#22c55e' : '' }} placeholder="€" />"""
content = content.replace(old_o2_input, new_o2_input)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added green highlights for achieved tramos")
