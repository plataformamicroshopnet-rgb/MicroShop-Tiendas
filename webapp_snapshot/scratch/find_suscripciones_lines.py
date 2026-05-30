with open(r"c:\Proyecto Tiendas\MicroShop Tiendas\webapp_snapshot\src\app\catalogos\page.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "Suscripciones TV" in line:
        print(f"Line {i+1}: {line.strip()}")
