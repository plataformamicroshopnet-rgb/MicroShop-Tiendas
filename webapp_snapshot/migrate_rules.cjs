const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rules = await prisma.tiendaCommissionRule.findMany();
    for (const rule of rules) {
        let newValue = rule.productosCuentan;
        
        if (rule.productosCuentan === 'miMovistar + Resto BAF') newValue = 'Alta BAF Total';
        else if (rule.productosCuentan === 'miMovistar') newValue = 'Alta BAF Convergente';
        else if (rule.productosCuentan === 'RENT + Seguro') newValue = 'Dispositivos + Seguro';
        else if (rule.productosCuentan === 'Movistar Prosegur Alarmas') newValue = 'MPA';
        else if (rule.productosCuentan === 'Solución FTTR') newValue = 'FTTR';
        else if (rule.productosCuentan === 'Solar360') newValue = 'Señalización Solar 360';
        else if (rule.productosCuentan === 'Repos') newValue = 'ARPU';
        else if (rule.productosCuentan === 'Extra Repos up destino Fúfbol' || rule.productosCuentan === 'Extra Repos up destino Fútbol') newValue = 'Repo Fútbol';
        
        if (newValue !== rule.productosCuentan) {
            await prisma.tiendaCommissionRule.update({
                where: { id: rule.id },
                data: { productosCuentan: newValue }
            });
            console.log(`Updated rule ${rule.nombre}: ${rule.productosCuentan} -> ${newValue}`);
        }
    }
}
main();
