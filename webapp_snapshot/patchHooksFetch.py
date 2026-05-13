import re

filepath = 'src/hooks/useComisionesData.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state variables
if "const [o2Rules, setO2Rules]" not in content:
    content = content.replace("const [tiendaHours, setTiendaHours] = useState<any[]>([]);", "const [tiendaHours, setTiendaHours] = useState<any[]>([]);\n    const [o2Rules, setO2Rules] = useState<any[]>([]);\n    const [o2Hours, setO2Hours] = useState<any[]>([]);")

# 2. Add to Promise.all
if "fetch(`/api/settings?key=o2_rules_v2_${activePeriodKey}`)" not in content:
    target_fetch = "fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({ success: false, rules: [], hours: [] }))"
    replacement_fetch = target_fetch + ",\n            fetch(`/api/settings?key=o2_rules_v2_${activePeriodKey}`).then(res => res.json()).catch(() => ({ value: null }))"
    content = content.replace(target_fetch, replacement_fetch)

# 3. Add to then block
if "o2Data" not in content:
    target_then = ".then(([data, condData, extrasData, rulesData, tiendasData]) => {"
    replacement_then = ".then(([data, condData, extrasData, rulesData, tiendasData, o2Data]) => {"
    content = content.replace(target_then, replacement_then)
    
    target_set = """if (tiendasData && tiendasData.success) {
                setTiendaRules(tiendasData.rules || []);
                setTiendaHours(tiendasData.hours || []);
            }"""
    replacement_set = target_set + """
            if (o2Data && o2Data.value) {
                try {
                    const parsed = JSON.parse(o2Data.value);
                    setO2Rules(parsed.rules || []);
                    setO2Hours(parsed.hours || []);
                } catch(e) {}
            } else {
                setO2Rules([]);
                setO2Hours([]);
            }"""
    content = content.replace(target_set, replacement_set)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added O2 rules fetching to useComisionesData.ts")
