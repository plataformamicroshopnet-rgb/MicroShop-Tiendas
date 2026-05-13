import re

filepath = 'src/components/ProductTreeSelector.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Filter out the categories and rename O2 to O2 MovilFree in the UI label
search_cat = "const categories = Object.keys(catalogs).sort()"
replace_cat = "const categories = Object.keys(catalogs).filter(cat => cat !== 'Fija' && cat !== 'Mvil' && cat !== 'Micro' && cat !== 'Móvil').sort()"

if replace_cat not in content:
    # Handle the  character issue by just using a generic filter or exact byte match
    # Since we can just write it in JS directly
    content = content.replace("const categories = Object.keys(catalogs).sort()", "const categories = Object.keys(catalogs).filter(cat => cat !== 'Fija' && cat !== 'M\\u00f3vil' && cat !== 'Mvil' && cat !== 'Micro').sort()")

# Render label correctly
search_render = "{renderCheckbox(cat, cat, true, () => toggleCat(cat), isExpanded)}"
replace_render = "{renderCheckbox(cat === 'O2' ? 'O2 MovilFree' : cat, cat, true, () => toggleCat(cat), isExpanded)}"
content = content.replace(search_render, replace_render)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated ProductTreeSelector")
