import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Look for handleCheckout
match = re.search(r"const handleCheckout = async \(\) => \{.*?\}", content, re.DOTALL)
if match:
    print(match.group(0))
