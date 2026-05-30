import sqlite3

conn = sqlite3.connect(r"c:\Proyecto Tiendas\MicroShop Tiendas\webapp_snapshot\prisma\database.sqlite")
cursor = conn.cursor()

# Get the schema of productCatalog
cursor.execute("PRAGMA table_info(ProductCatalog)")
print("ProductCatalog Table Info:")
for col in cursor.fetchall():
    print(col)

# Get the rows in ProductCatalog where categoria = 'Suscripciones TV'
cursor.execute("SELECT * FROM ProductCatalog WHERE categoria = 'Suscripciones TV'")
rows = cursor.fetchall()
print("\nSuscripciones TV Rows:")
for r in rows:
    print(r)

conn.close()
