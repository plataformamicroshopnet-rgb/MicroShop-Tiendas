import re

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# The first card is for TABLA 1: TERRITORIAL TIENDAS
content = content.replace(
    """      {/* TABLA 1: TERRITORIAL TIENDAS */}
      <div className="card" style={{ padding: 0, marginBottom: 32, overflow: 'visible' }}>""",
    """      {/* TABLA 1: TERRITORIAL TIENDAS */}
      <div className="card" style={{ padding: 0, marginBottom: 32, overflow: 'visible', position: 'relative', zIndex: 20 }}>"""
)

# The second card is for TABLA 2: O2 MOVILFREE
content = content.replace(
    """      {/* TABLA 2: O2 MOVILFREE */}
      <div className="card" style={{ padding: 0, marginBottom: 32, overflow: 'visible' }}>""",
    """      {/* TABLA 2: O2 MOVILFREE */}
      <div className="card" style={{ padding: 0, marginBottom: 32, overflow: 'visible', position: 'relative', zIndex: 10 }}>"""
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("z-index applied to cards")
