import re

filepath = 'src/app/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("import { FeaturedMagazine } from '@/components/FeaturedMagazine'\n", "")
content = content.replace("import { FeaturedDocument } from '@/components/FeaturedDocument'\n", "")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Cleaned up unused imports")
