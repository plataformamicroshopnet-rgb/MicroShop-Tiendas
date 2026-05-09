function matchProductFormula(productName, formula) {
    if (!formula || !productName) return false;
    const p = String(productName).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    // Split by '+' (OR)
    const orBlocks = formula.split('+').map(b => b.trim());
    
    for (const block of orBlocks) {
        if (!block) continue;
        
        // Split by ' -' (Exclusions)
        // We use split(' -') so that "miMovistar -Repos" becomes ["miMovistar", "Repos"]
        const parts = block.split(' -').map(p => p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
        
        const mustInclude = parts[0];
        const mustNotIncludes = parts.slice(1);
        
        if (p.includes(mustInclude)) {
            // Check if any exclusion is present
            let isExcluded = false;
            for (const excl of mustNotIncludes) {
                if (excl && p.includes(excl)) {
                    isExcluded = true;
                    break;
                }
            }
            
            if (!isExcluded) return true; // Found a matching OR block that is not excluded
        }
    }
    return false;
}

const laraSale = "Repos destino BAF miMovistar/Fusión incremento de ARPU >=10€ y < 35€ Repos";
const carlosSale = "Contrato O2 - Alta y Porta Sólo Móvil Ti";

console.log("Lara match Alta BAF Convergente (miMovistar):", matchProductFormula(laraSale, "miMovistar"));
console.log("Lara match Alta BAF Convergente (miMovistar -Repos):", matchProductFormula(laraSale, "miMovistar -Repos"));
console.log("Lara match ARPU (incremento de ARPU):", matchProductFormula(laraSale, "incremento de ARPU"));
console.log("Carlos match Alta BAF Total (O2):", matchProductFormula(carlosSale, "O2"));
console.log("Carlos match Alta BAF Total (O2 -Sólo Móvil):", matchProductFormula(carlosSale, "O2 -Solo Movil"));
