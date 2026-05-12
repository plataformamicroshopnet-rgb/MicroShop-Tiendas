import re

filepath = 'src/app/movilfree/print/[id]/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add the import
if 'import AutoPrint' not in content:
    content = "import AutoPrint from '@/components/AutoPrint'\n" + content

# Replace the script tags with <AutoPrint />
content = re.sub(
    r"<script dangerouslySetInnerHTML={{ __html: 'setTimeout\(function\(\) \{ window\.print\(\); \}, 500\);' }} />",
    "<AutoPrint />",
    content
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added AutoPrint client component")
