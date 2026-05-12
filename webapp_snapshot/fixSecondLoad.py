import re

filepath = 'src/app/movilfree/print/[id]/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the remaining onLoad handler
content = content.replace(
    '<body onLoad={() => window.print()}>',
    '<body>\n        <script dangerouslySetInnerHTML={{ __html: \'window.onload = function() { window.print(); }\' }} />'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed second onLoad error")
