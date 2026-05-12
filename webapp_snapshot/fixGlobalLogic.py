import re

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update calculateTiendaImporte definition
old_def = """  const calculateTiendaImporte = (rule: any, storeName: string, salesCount: number) => {
    let earned = 0;
    
    // Eval 1er Tramo
    let target1 = 0;
    if (rule.obj1Type === 'per_store') target1 = parseNumber(rule.obj1Stores?.[storeName] || '0');
    else target1 = parseNumber(rule.obj1Global);

    // Eval 2do Tramo
    let target2 = 0;
    if (rule.obj2Type === 'per_store') target2 = parseNumber(rule.obj2Stores?.[storeName] || '0');
    else target2 = parseNumber(rule.obj2Global);

    const isMoneyType = String(rule.tipoVenta).toLowerCase().includes('dispositivos');
    const import1Num = parseNumber(rule.importe1);
    const import2Num = parseNumber(rule.importe2);

    const isPct1 = String(rule.importe1).includes('%');
    const isPct2 = String(rule.importe2).includes('%');

    // Si supera Tramo 2
    if (target2 > 0 && salesCount >= target2) {
      if (isPct2) earned = salesCount * (import2Num / 100);
      else earned = import2Num;
    } 
    // Si no supera Tramo 2 pero supera Tramo 1
    else if (target1 > 0 && salesCount >= target1) {
      if (isPct1) earned = salesCount * (import1Num / 100);
      else earned = import1Num;
    }

    return earned;
  }"""
new_def = """  const calculateTiendaImporte = (rule: any, storeName: string, salesCount: number, salesTot: number) => {
    let earned = 0;
    
    // Eval 1er Tramo
    let target1 = 0;
    let isReached1 = false;
    if (rule.obj1Type === 'per_store') {
      target1 = parseNumber(rule.obj1Stores?.[storeName] || '0');
      isReached1 = target1 > 0 && salesCount >= target1;
    } else {
      target1 = parseNumber(rule.obj1Global);
      isReached1 = target1 > 0 && salesTot >= target1;
    }

    // Eval 2do Tramo
    let target2 = 0;
    let isReached2 = false;
    if (rule.obj2Type === 'per_store') {
      target2 = parseNumber(rule.obj2Stores?.[storeName] || '0');
      isReached2 = target2 > 0 && salesCount >= target2;
    } else {
      target2 = parseNumber(rule.obj2Global);
      isReached2 = target2 > 0 && salesTot >= target2;
    }

    const import1Num = parseNumber(rule.importe1);
    const import2Num = parseNumber(rule.importe2);

    const isPct1 = String(rule.importe1).includes('%');
    const isPct2 = String(rule.importe2).includes('%');

    // Si supera Tramo 2
    if (isReached2) {
      if (isPct2) earned = salesCount * (import2Num / 100);
      else earned = import2Num;
    } 
    // Si no supera Tramo 2 pero supera Tramo 1
    else if (isReached1) {
      if (isPct1) earned = salesCount * (import1Num / 100);
      else earned = import1Num;
    }

    return earned;
  }"""
content = content.replace(old_def, new_def)

# 2. Update usages in map
old_usages = """                const impAux = calculateTiendaImporte(rule, 'Auxiliadora 45', salesAux);
                const impCor = calculateTiendaImporte(rule, 'Correhuela', salesCor);
                const impVil = calculateTiendaImporte(rule, 'Villamayor', salesVil);
                const impBej = calculateTiendaImporte(rule, 'Béjar', salesBej);"""
new_usages = """                const impAux = calculateTiendaImporte(rule, 'Auxiliadora 45', salesAux, salesTot);
                const impCor = calculateTiendaImporte(rule, 'Correhuela', salesCor, salesTot);
                const impVil = calculateTiendaImporte(rule, 'Villamayor', salesVil, salesTot);
                const impBej = calculateTiendaImporte(rule, 'Béjar', salesBej, salesTot);"""
content = content.replace(old_usages, new_usages)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated target logic for global rules")
