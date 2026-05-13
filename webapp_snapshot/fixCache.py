import re

filepath = 'src/components/ProductTreeSelector.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add cache busting to the fetch
content = content.replace("fetch('/api/catalogs')", "fetch(`/api/catalogs?_t=${Date.now()}`)")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added cache busting to ProductTreeSelector")
