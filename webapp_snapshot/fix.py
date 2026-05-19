import sys

filepath = r"c:\Proyecto Tiendas\MicroShop Tiendas\webapp_snapshot\src\hooks\useComisionesData.ts"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """    const cat = sale.categoria || sale.detalle || sale.sheet || '';
    const prod = sale.producto || '';

    for (const tipoVenta of tipos) {
        if (tipoVenta === 'FORMULA_LIBRE') continue;
        
        let matched = false;
        switch(tipoVenta) {
            case 'Alta BAF Total':
                matched = cat === 'miMovistar' || cat === 'Resto BAF';
                break;
            case 'Alta BAF Convergente':
                matched = cat === 'miMovistar';
                break;
            case 'Dispositivos + Seguro':
                matched = cat === 'Rent' || cat === 'Seguro';
                break;
            case 'Dispositivos':
                matched = cat === 'Rent';
                break;
            case 'Seguro':
                matched = cat === 'Seguro';
                break;
            case 'MPA':
                matched = prod.includes('Movistar Prosegur Alarmas');
                break;
            case 'FTTR':
                matched = prod.includes('Solución FTTR') || prod.includes('FTTR');
                break;
            case 'Señalización Solar 360':
                matched = prod.includes('Solar360');
                break;
            case 'ARPU':
                matched = cat === 'Repos' && !prod.includes('Fútbol');
                break;
            case 'Repo Fútbol':
                matched = prod.includes('Fútbol') && cat === 'Repos';
                break;
            default:
                if (tipoVenta.toLowerCase().trim() === cat.toLowerCase().trim()) {
                    matched = true;
                } else {
                    const searchString = `${prod} ${sale.detalle || ''} ${sale.grupo || ''}`;
                    matched = matchProductFormula(searchString, tipoVenta);
                }
                break;
        }"""

replacement = """    const catRaw = sale.categoria || sale.detalle || sale.sheet || '';
    const cat = String(catRaw).trim().toLowerCase();
    const prod = String(sale.producto || '').trim().toLowerCase();

    for (const tipoVenta of tipos) {
        if (tipoVenta === 'FORMULA_LIBRE') continue;
        
        let matched = false;
        switch(tipoVenta.toLowerCase().trim()) {
            case 'alta baf total':
                matched = cat === 'mimovistar' || cat === 'resto baf';
                break;
            case 'alta baf convergente':
                matched = cat === 'mimovistar';
                break;
            case 'dispositivos + seguro':
                matched = cat === 'rent' || cat === 'seguro';
                break;
            case 'dispositivos':
                matched = cat === 'rent';
                break;
            case 'seguro':
                matched = cat === 'seguro';
                break;
            case 'mpa':
                matched = prod.includes('movistar prosegur alarmas') || prod.includes('mpa') || prod.includes('alarma');
                break;
            case 'fttr':
                matched = prod.includes('solución fttr') || prod.includes('solucion fttr') || prod.includes('fttr');
                break;
            case 'señalización solar 360':
                matched = prod.includes('solar360') || prod.includes('solar 360') || prod.includes('solar');
                break;
            case 'arpu':
                matched = cat === 'repos' && !prod.includes('fútbol') && !prod.includes('futbol');
                break;
            case 'repo fútbol':
                matched = (prod.includes('fútbol') || prod.includes('futbol')) && cat === 'repos';
                break;
            default:
                if (tipoVenta.toLowerCase().trim() === cat) {
                    matched = true;
                } else {
                    const searchString = `${prod} ${String(sale.detalle || '').toLowerCase()} ${String(sale.grupo || '').toLowerCase()}`;
                    matched = matchProductFormula(searchString, tipoVenta);
                }
                break;
        }"""

if target in content:
    content = content.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Target not found. Doing a flexible replace.")
    import re
    # Try just replacing the switch case logic
    match_switch = re.search(r'switch\s*\(\s*tipoVenta\s*\)\s*\{.*?\n\s*\}', content, re.DOTALL)
    if match_switch:
        print("Found switch via regex")
"""
