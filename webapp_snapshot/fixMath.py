import re

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update calculateO2Importe
old_calc = """  const calculateO2Importe = (rule: any, totalSales: number) => {
    let bonus = 0;
    
    // Encontrar el tramo Mes más alto alcanzado
    for (const tramo of [...TRAMOS_MES].reverse()) {
      if (totalSales >= tramo.min) {
        bonus += parseNumber(rule.tramosMes[tramo.key] || '0');
        break; // Solo el tramo más alto
      }
    }

    // Calcular Conectividad (siempre se paga por unidad)
    const conectVal = parseNumber(rule.conectividad || '0');
    bonus += (totalSales * conectVal);

    // NOTA: Los tramos trimestrales requieren lógica de ventas trimestrales.
    // Como estamos en un solo mes en este dashboard, es complejo calcular el trimestre exacto
    // a menos que sumemos los periodos anteriores. Por ahora lo dejamos disponible para el UI.

    return bonus;
  }"""
new_calc = """  const calculateO2Importe = (rule: any, totalSales: number) => {
    let bonus = 0;
    
    for (const tramo of [...TRAMOS_MES].reverse()) {
      if (totalSales >= tramo.min) {
        bonus += parseNumber(rule.tramosMes?.[tramo.key] || '0');
        break;
      }
    }

    for (const tramo of [...TRAMOS_TRIM].reverse()) {
      if (totalSales >= tramo.min) {
        bonus += parseNumber(rule.tramosTrim?.[tramo.key] || '0');
        break;
      }
    }

    if (totalSales > 0) {
      bonus += parseNumber(rule.conectividad || '0');
    }

    return bonus;
  }"""
content = content.replace(old_calc, new_calc)

# 2. Update the logic inside the map
old_map_logic = """                let highestTramoKey = '';
                for (const tramo of [...TRAMOS_MES].reverse()) {
                  if (totalSales >= tramo.min) {
                    highestTramoKey = tramo.key;
                    break;
                  }
                }"""
new_map_logic = """                let highestTramoMesKey = '';
                for (const tramo of [...TRAMOS_MES].reverse()) {
                  if (totalSales >= tramo.min) {
                    highestTramoMesKey = tramo.key;
                    break;
                  }
                }
                let highestTramoTrimKey = '';
                for (const tramo of [...TRAMOS_TRIM].reverse()) {
                  if (totalSales >= tramo.min) {
                    highestTramoTrimKey = tramo.key;
                    break;
                  }
                }"""
content = content.replace(old_map_logic, new_map_logic)

# 3. Update the inputs for tramosMes
old_input_mes = """highestTramoKey === t.key"""
new_input_mes = """highestTramoMesKey === t.key"""
content = content.replace(old_input_mes, new_input_mes)

# 4. Update the inputs for tramosTrim
old_input_trim = """<input value={rule.tramosTrim?.[t.key] || ''} onChange={e => { const r = [...o2Rules]; r[idx].tramosTrim = { ...(r[idx].tramosTrim || {}), [t.key]: e.target.value }; setO2Rules(r); }} className="form-input" style={{ width: 60 }} placeholder="€" />"""
new_input_trim = """<input value={rule.tramosTrim?.[t.key] || ''} onChange={e => { const r = [...o2Rules]; r[idx].tramosTrim = { ...(r[idx].tramosTrim || {}), [t.key]: e.target.value }; setO2Rules(r); }} className="form-input" style={{ width: 60, backgroundColor: highestTramoTrimKey === t.key ? '#dcfce7' : '', color: highestTramoTrimKey === t.key ? '#166534' : '', fontWeight: highestTramoTrimKey === t.key ? 'bold' : 'normal', borderColor: highestTramoTrimKey === t.key ? '#22c55e' : '' }} placeholder="€" />"""
content = content.replace(old_input_trim, new_input_trim)

# 5. Highlight Conectividad
old_conect = """<input value={rule.conectividad} onChange={e => { const r = [...o2Rules]; r[idx].conectividad = e.target.value; setO2Rules(r); }} className="form-input" style={{ width: 50 }} placeholder="€" />"""
new_conect = """<input value={rule.conectividad || ''} onChange={e => { const r = [...o2Rules]; r[idx].conectividad = e.target.value; setO2Rules(r); }} className="form-input" style={{ width: 50, backgroundColor: totalSales > 0 && parseNumber(rule.conectividad) > 0 ? '#dcfce7' : '', color: totalSales > 0 && parseNumber(rule.conectividad) > 0 ? '#166534' : '', fontWeight: totalSales > 0 && parseNumber(rule.conectividad) > 0 ? 'bold' : 'normal', borderColor: totalSales > 0 && parseNumber(rule.conectividad) > 0 ? '#22c55e' : '' }} placeholder="€" />"""
content = content.replace(old_conect, new_conect)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Math and highlights updated for O2")
