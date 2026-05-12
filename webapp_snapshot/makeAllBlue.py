import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Make search icon always blue
content = content.replace(
    "<Search size={18} style={{ position: 'absolute', left: 14, top: 13, color: activeTab === 'devoluciones' ? '#0284c7' : '#888' }} />",
    "<Search size={18} style={{ position: 'absolute', left: 14, top: 13, color: '#0284c7' }} />"
)

# Apply blue styles to all search inputs
content = content.replace(
    "style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, border: '1px solid #ddd', fontSize: 14, background: 'white' }}",
    "style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 14 }}"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied light blue styling to all dynamic search bars")
