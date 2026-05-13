import re

filepath = 'src/app/comisiones/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Destructure o2Rules
content = content.replace("tiendaRules\n    } = useComisionesData()", "tiendaRules,\n        o2Rules\n    } = useComisionesData()")

# Inject activeRulesForSeller logic
search_target = "{tiendaRules && tiendaRules.length > 0 ? tiendaRules.map((rule: any, idx: number) => {"
replace_target = """{(() => {
                                                const activeRulesForSeller = String(s.name).toLowerCase().includes('marta') ? (o2Rules || []) : (tiendaRules || []);
                                                return activeRulesForSeller.length > 0 ? activeRulesForSeller.map((rule: any, idx: number) => {"""

if search_target in content:
    content = content.replace(search_target, replace_target)
    
    # We need to close the IIFE
    search_close = "}) : <tr><td colSpan={10} style={{padding: 20, textAlign: 'center', color: '#64748b'}}>No hay reglas de comisin configuradas para este mes.</td></tr>}"
    
    # Wait, because of Spanish characters in the file, we can just replace the closing brace
    # Let's find the closing brace by searching for the "No hay reglas" row
    content = content.replace("}) : <tr><td colSpan={10} style={{padding: 20, textAlign: 'center', color: '#64748b'}}>No hay reglas de comisi\u00f3n configuradas para este mes.</td></tr>}", "}) : <tr><td colSpan={10} style={{padding: 20, textAlign: 'center', color: '#64748b'}}>No hay reglas de comisi\u00f3n configuradas para este mes.</td></tr>\n                                            })()}")
else:
    print("Could not find search_target")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated comisiones/page.tsx to render o2Rules for Marta")
