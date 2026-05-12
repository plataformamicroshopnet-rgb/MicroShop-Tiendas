import os
import glob

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Replace literal strings
    content = content.replace("'RENT'", "'Rent'")
    content = content.replace('"RENT"', '"Rent"')
    content = content.replace("'PREPAGO'", "'Prepago'")
    content = content.replace('"PREPAGO"', '"Prepago"')
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

# Find all TS/TSX files
for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            replace_in_file(os.path.join(root, file))

print("Replacement complete.")
