import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>",
    "<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Increased table font size to 14px")
