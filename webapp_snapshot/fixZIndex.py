import re

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace TR for Tiendas table
content = content.replace(
    "<tr key={rule.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--section-bg)' }}>",
    "<tr key={rule.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--section-bg)', position: 'relative', zIndex: 1000 - idx }}>"
)

# Replace TR for O2 table (it's the exact same string usually, so the above might replace both if we used replace all, but let's be sure. Actually replace replaces all occurrences)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("z-index added to tr")
