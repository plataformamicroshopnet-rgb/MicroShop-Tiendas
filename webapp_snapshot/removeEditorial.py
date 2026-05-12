import re

filepath = 'src/app/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# We need to remove the whole SECCIÓN EDITORIAL block.
# Let's find it using regex or string splits
editorial_start = "{/* SECCIÓN EDITORIAL (REVISTAS, CATÁLOGOS Y DOSIER) */}"
if editorial_start in content:
    pre, post = content.split(editorial_start)
    # the section ends exactly at the end of the file before `    </div>\n  )\n}\n`
    # We can just remove everything after the editorial_start up to `    </div>\n  )\n}\n`
    new_content = pre.rstrip() + "\n    </div>\n  )\n}\n"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Removed Editorial Section")
else:
    print("Could not find section")
