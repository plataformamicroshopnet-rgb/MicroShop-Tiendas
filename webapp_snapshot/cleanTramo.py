import re

filepath = 'src/app/operaciones-grupo-cliente/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove from map:
content = re.sub(r",\s*'Pago por Tramo[^\']*':\s*fmtN\([^)]+\)", "", content)

# 2. Remove from extras:
content = re.sub(r",\s*'Pago por Tramo[^\']*':\s*fmtN\([^)]+\)", "", content)

# 3. Remove from summaryRows push:
content = re.sub(r"'Pago por Tramo[^\']*':\s*fmtN\([^)]+\)", "", content)

# Clean up trailing commas before closing braces if any were created:
content = re.sub(r",\s+\}", " }", content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Cleaned up remaining Tramo columns")
