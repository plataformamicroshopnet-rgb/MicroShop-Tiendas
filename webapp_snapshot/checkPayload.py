import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Look for payload
match = re.search(r"const payload = \{.*?\}", content, re.DOTALL)
if match:
    print(match.group(0))
