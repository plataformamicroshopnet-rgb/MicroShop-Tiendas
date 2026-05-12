import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix broken table tag
content = content.replace(
    "{{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>",
    "<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>"
)

# And DEVOLUCIONES? Let's check where the third search bar went.
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
