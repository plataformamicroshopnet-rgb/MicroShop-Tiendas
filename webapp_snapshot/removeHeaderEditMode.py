import re

filepath = 'src/app/liquidacion/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

header_actions_regex = re.compile(r"headerActions=\{\s*currentView === 'menu' \? \(\s*isEditMode \? \([\s\S]*?\) \: \(\s*<button onClick=\{\(\) => \{(?:[\s\S]*?)<\/button>\s*\)\s*\) : undefined\s*\}", re.MULTILINE)

content = re.sub(header_actions_regex, "headerActions={undefined}", content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed headerActions edit mode logic")
