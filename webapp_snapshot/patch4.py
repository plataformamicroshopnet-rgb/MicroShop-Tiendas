import re

with open('src/app/liquidacion/rentabilidad-tiendas/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """  const [expandedTiendas, setExpandedTiendas] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.keys(TIENDAS_COMERCIALES).forEach(t => initial[t] = true);
    return initial;
  })"""

content = re.sub(r'  const \[expandedTiendas, setExpandedTiendas\] = useState<Record<string, boolean>>\(\{\}\)', replacement, content)

with open('src/app/liquidacion/rentabilidad-tiendas/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated successfully")
