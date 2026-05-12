import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add states
content = content.replace(
    "const [pasteText, setPasteText] = useState('')",
    "const [pasteText, setPasteText] = useState('')\n  const [searchInvProducts, setSearchInvProducts] = useState('')\n  const [searchClients, setSearchClients] = useState('')\n  const [searchSales, setSearchSales] = useState('')"
)

# 2. Add search bar to TAB: PRODUCTOS and filter the table
search_inv = """              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: '#333' }}>Listado de Productos</h3>
                <div style={{ position: 'relative', width: '300px' }}>
                  <Search size={18} style={{ position: 'absolute', left: 10, top: 10, color: '#888' }} />
                  <input placeholder="Buscar producto..." value={searchInvProducts} onChange={e=>setSearchInvProducts(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 8, border: '1px solid #ddd' }} />
                </div>
              </div>
              <table style="""

content = content.replace("<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>", search_inv.replace("<table style=", "<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>"), 1)
content = content.replace(
    "<tbody>\n                  {products.map(p => (",
    "<tbody>\n                  {products.filter(p => p.nombre.toLowerCase().includes(searchInvProducts.toLowerCase())).map(p => ("
)

# 3. Add search bar to TAB: CLIENTES
search_cli = """              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: '#333' }}>Listado de Clientes</h3>
                <div style={{ position: 'relative', width: '300px' }}>
                  <Search size={18} style={{ position: 'absolute', left: 10, top: 10, color: '#888' }} />
                  <input placeholder="Buscar por NIF/CIF..." value={searchClients} onChange={e=>setSearchClients(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 8, border: '1px solid #ddd' }} />
                </div>
              </div>
              <table style="""

# find the table in TAB: CLIENTES. The easiest way is to find the clients map.
content = content.replace("<tbody>\n                  {clients.map(c => (", "<tbody>\n                  {clients.filter(c => c.nif.toLowerCase().includes(searchClients.toLowerCase())).map(c => (")

# to place the search bar for clients, we find the table just before the tbody we replaced
# Actually, the Clients tab has a <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
# It's the 3rd table in the file (1st is POS cart, 2nd is POS catalog? No POS catalog uses divs. 1st is POS cart, 2nd is Inventario, 3rd is Clientes, 4th is Histórico).
# Let's replace the exact string in the CLIENTES tab.
cli_table = """              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#FFF0F9', color: '#E91E97' }}>
                    <th style={{ padding: 12, borderRadius: '8px 0 0 8px' }}>NIF</th>"""
content = content.replace(cli_table, search_cli.replace("<table style=", cli_table.split("              <table style=")[1]))

# 4. Add search bar to TAB: DEVOLUCIONES
search_sales = """              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: '#333' }}>Histórico de Ventas</h3>
                <div style={{ position: 'relative', width: '400px' }}>
                  <Search size={18} style={{ position: 'absolute', left: 10, top: 10, color: '#888' }} />
                  <input placeholder="Buscar por cliente, NIF, vendedor o nº factura..." value={searchSales} onChange={e=>setSearchSales(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 8, border: '1px solid #ddd' }} />
                </div>
              </div>
              <table style="""

sales_table = """              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', color: '#555' }}>
                    <th style={{ padding: 12, borderRadius: '8px 0 0 8px' }}>Nº Fact.</th>"""

content = content.replace(sales_table, search_sales.replace("<table style=", sales_table.split("              <table style=")[1]))

content = content.replace(
    "<tbody>\n                  {sales.map(s => (",
    "<tbody>\n                  {sales.filter(s => \n                    (s.nombreCliente || '').toLowerCase().includes(searchSales.toLowerCase()) ||\n                    (s.nifCliente || '').toLowerCase().includes(searchSales.toLowerCase()) ||\n                    (s.vendedor || '').toLowerCase().includes(searchSales.toLowerCase()) ||\n                    (s.numeroFactura ? s.numeroFactura.toString() : '').includes(searchSales)\n                  ).map(s => ("
)


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added 3 search bars")
