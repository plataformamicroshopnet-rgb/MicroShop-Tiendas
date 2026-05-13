import re

filepath = 'src/app/catalogos/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove 'use client'
content = content.replace("'use client'\n", "")
content = content.replace('"use client"\n', "")

# Add it at the very top
content = "'use client'\n" + content

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Moved 'use client' to the top")
