import re

filepath_in = 'src/app/catalogos/ProductosComisionanTab.tsx'
filepath_out = 'src/app/catalogos/ComisionesO2Tab.tsx'

with open(filepath_in, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace component name
content = content.replace("export default function ProductosComisionanTab() {", "export default function ComisionesO2Tab() {")

# Replace API fetch
fetch_search = "fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`)"
fetch_replace = """fetch(`/api/settings?key=o2_rules_v2_${activePeriodKey}`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.value) {
          try {
            const parsed = JSON.parse(res.value);
            setRules(parsed.rules || [])
            setHours(parsed.hours || [])
          } catch(e) {}
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))"""

# We need to manually replace the fetch block because the promise chaining is different.
# Let's do it cleanly:
content_parts = content.split("useEffect(() => {")
if len(content_parts) == 2:
    end_effect = content_parts[1].find("}, [activePeriodKey])")
    
    new_effect = """
    if (!activePeriodKey) return
    setLoading(true)
    fetch(`/api/settings?key=o2_rules_v2_${activePeriodKey}`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.value) {
          try {
            const parsed = JSON.parse(res.value);
            setRules(parsed.rules || [])
            setHours(parsed.hours || [])
          } catch(e) {}
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  """
    
    content = content_parts[0] + "useEffect(() => {" + new_effect + content_parts[1][end_effect:]

# Replace API save
save_search = """const res = await fetch('/api/tiendas-comisiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodKey: activePeriodKey, rules, hours })
      })"""
save_replace = """const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: `o2_rules_v2_${activePeriodKey}`, value: JSON.stringify({ rules, hours }) })
      })"""
content = content.replace(save_search, save_replace)

# Change title
content = content.replace("1. Reglas Globales y Tramos de Comisiones", "1. Reglas Globales O2 / MovilFree")

with open(filepath_out, 'w', encoding='utf-8') as f:
    f.write(content)

print("Created ComisionesO2Tab.tsx as a clone of ProductosComisionanTab.tsx with AppSettings logic")
