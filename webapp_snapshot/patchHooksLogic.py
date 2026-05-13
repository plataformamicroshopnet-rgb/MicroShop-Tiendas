import re

filepath = 'src/hooks/useComisionesData.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the hardcoded exclusion of Marta:
# We will just remove it.
content = content.replace("""            // Excluir temporalmente a Marta (Tienda O2)
            if (String(name).toLowerCase().includes('marta')) {
                groupObj1[ruleName] = 0;
                groupObj2[ruleName] = 0;
            }""", "")

# We need to introduce the dynamic rule selection inside sellerStats map
search_target_seller_start = "const comercialHour = tiendaHours.find(h => String(h.comercial).toLowerCase() === String(name).toLowerCase());"
replace_target_seller_start = """const isO2 = String(name).toLowerCase().includes('marta');
        const activeTiendaRules = isO2 ? o2Rules : tiendaRules;
        const activeTiendaHours = isO2 ? o2Hours : tiendaHours;
        
        const comercialHour = activeTiendaHours.find(h => String(h.comercial).toLowerCase() === String(name).toLowerCase());"""

content = content.replace(search_target_seller_start, replace_target_seller_start)

# Replace 'tiendaRules.forEach' with 'activeTiendaRules.forEach' ONLY inside sellerStats
# To do this safely, we will split by "const sellerStats = FIXED_SELLERS.map(name => {"
parts = content.split("const sellerStats = FIXED_SELLERS.map(name => {")
if len(parts) == 2:
    parts[1] = parts[1].replace("tiendaRules.forEach", "activeTiendaRules.forEach")
    content = parts[0] + "const sellerStats = FIXED_SELLERS.map(name => {" + parts[1]

# Now for the pre-calculation of teamGroupCounts, we need both Movistar and O2 versions, or since we only care about the team of the active seller inside the loop, we can just compute it per seller, or we compute both at the top.
# Let's compute both at the top.
search_team_counts = """    const teamGroupCounts: Record<string, number> = {};
    tiendaRules.forEach(rule => { teamGroupCounts[rule.nombre] = 0; });

    monthSales.forEach(s => {
        let cuotaValue = Number(s.cuota) || 0;
        if (isNaN(cuotaValue)) cuotaValue = 0;
        
        tiendaRules.forEach(rule => {
            if (matchTipoVenta(s, rule.productosCuentan)) {
                const isPercentage = String(rule.importePrimerTramo || '').includes('%');
                if (isPercentage) {
                    teamGroupCounts[rule.nombre] += cuotaValue;
                } else {
                    teamGroupCounts[rule.nombre] += 1;
                }
            }
        });
    });"""

replace_team_counts = """    const teamGroupCounts: Record<string, number> = {};
    const o2TeamGroupCounts: Record<string, number> = {};
    
    tiendaRules.forEach(rule => { teamGroupCounts[rule.nombre] = 0; });
    o2Rules.forEach(rule => { o2TeamGroupCounts[rule.nombre] = 0; });

    monthSales.forEach(s => {
        let cuotaValue = Number(s.cuota) || 0;
        if (isNaN(cuotaValue)) cuotaValue = 0;
        
        // Movistar
        if (!String(s.vendedor).toLowerCase().includes('marta')) {
            tiendaRules.forEach(rule => {
                if (matchTipoVenta(s, rule.productosCuentan)) {
                    const isPercentage = String(rule.importePrimerTramo || '').includes('%');
                    if (isPercentage) {
                        teamGroupCounts[rule.nombre] += cuotaValue;
                    } else {
                        teamGroupCounts[rule.nombre] += 1;
                    }
                }
            });
        }
        
        // O2
        if (String(s.vendedor).toLowerCase().includes('marta')) {
            o2Rules.forEach(rule => {
                if (matchTipoVenta(s, rule.productosCuentan)) {
                    const isPercentage = String(rule.importePrimerTramo || '').includes('%');
                    if (isPercentage) {
                        o2TeamGroupCounts[rule.nombre] += cuotaValue;
                    } else {
                        o2TeamGroupCounts[rule.nombre] += 1;
                    }
                }
            });
        }
    });"""

content = content.replace(search_team_counts, replace_team_counts)

# Now we need to use activeTeamGroupCounts inside the seller map.
parts2 = content.split("const comercialHour = activeTiendaHours.find(")
if len(parts2) == 2:
    parts2[1] = parts2[1].replace("teamGroupCounts[ruleName]", "activeTeamGroupCounts[ruleName]")
    content = parts2[0] + "const activeTeamGroupCounts = isO2 ? o2TeamGroupCounts : teamGroupCounts;\n        const comercialHour = activeTiendaHours.find(" + parts2[1]

# Make sure we also return o2Rules so components can use them if needed
content = content.replace("tiendaRules\n    };", "tiendaRules,\n        o2Rules\n    };")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated useComisionesData to dynamically switch rules between Movistar and O2")
