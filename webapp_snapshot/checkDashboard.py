import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Let's find the top dashboard boxes
match = re.search(r"\{\/\* TOP DASHBOARD \*\/\}.*?(?=\s*<div style=\{\{ display: 'flex')|(?=<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)", content, re.DOTALL)
if match:
    print(match.group(0)[:1500])
else:
    # try just finding a grid of metrics
    match2 = re.search(r"<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(.*?\}\}>.*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>", content, re.DOTALL)
    if match2:
        print(match2.group(0)[:1500])
