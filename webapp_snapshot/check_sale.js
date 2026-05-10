const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const allSales = await prisma.sale.findMany({
        where: {
            vendedor: 'Cristina',
            producto: { contains: 'APPLE MacBook Pro 16' }
        },
        include: { period: true }
    });
    if (allSales.length === 0) {
        console.log("No sale found with this product name for Cristina.");
        // let's try to find ANY sale with MacBook Pro
        const anySales = await prisma.sale.findMany({
            where: {
                producto: { contains: 'MacBook Pro' }
            }
        });
        console.log("Found ANY sale with MacBook Pro:", anySales);
        return;
    }
    const targetSale = allSales[0];
    console.log("Found sale:", targetSale);
    console.log("Period key:", targetSale.period ? targetSale.period.period_key : 'None');
    
    if (!targetSale.period) return;
    
    const rules = await prisma.tiendaCommissionRule.findMany({
        where: { periodKey: targetSale.period.period_key }
    });

    console.log(`Found ${rules.length} rules.`);

    const matchTipoVenta = (sale, tipoVentaRaw) => {
        if (!tipoVentaRaw) return false;
        const tipos = tipoVentaRaw.split(',').map(s => s.trim()).filter(Boolean);
        const cat = sale.categoria || sale.detalle || sale.sheet || '';
        const prod = sale.producto || '';

        const matchProductFormula = (productName, formula) => {
            if (!formula || !productName) return false;
            const p = String(productName).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const orBlocks = formula.split('+').map(b => b.trim());
            for (const block of orBlocks) {
                if (!block) continue;
                const parts = block.split(' -').map(part => part.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
                const mustInclude = parts[0];
                const mustNotIncludes = parts.slice(1);
                
                if (mustInclude && p.includes(mustInclude)) {
                    let isExcluded = false;
                    for (const excl of mustNotIncludes) {
                        if (excl && p.includes(excl)) {
                            isExcluded = true;
                            break;
                        }
                    }
                    if (!isExcluded) return true;
                }
            }
            return false;
        };

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
                    matched = cat === 'RENT' || cat === 'Seguro';
                    break;
                case 'Dispositivos':
                    matched = cat === 'RENT';
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
            }
            if (matched) return true;
        }
        return false;
    };

    rules.forEach(rule => {
        if (matchTipoVenta(targetSale, rule.productosCuentan)) {
            console.log(`Matched rule: ${rule.nombre} with productosCuentan=${rule.productosCuentan}`);
        }
    });

}
main().finally(() => prisma.$disconnect());
