import re

filepath = 'src/app/catalogos/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'const handleBulkImport = \(\) => \{(.*?)\} else if \(activeTab === ''O2''\) \{', content, re.DOTALL)
if match:
    print("Found it")
else:
    print("Could not extract")
