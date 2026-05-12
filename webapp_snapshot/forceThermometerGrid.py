import re

filepath = 'src/app/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the grid in the Termómetro block
old_grid = "<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>"
new_grid = "<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>"

content = content.replace(old_grid, new_grid)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Forced 3 column grid for Thermometer")
