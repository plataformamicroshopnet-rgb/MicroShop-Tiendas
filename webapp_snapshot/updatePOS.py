import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add clientName state
content = content.replace(
    "const [saleVendedor, setSaleVendedor] = useState('')",
    "const [clientName, setClientName] = useState('')\n  const [showSuggestions, setShowSuggestions] = useState(false)"
)

# 2. Update handleCheckout payload
old_checkout = """    const cl = clients.find(c => c.nif === selectedClient)
    
    const payload = {
      vendedor: saleVendedor || 'Marta',
      nifCliente: selectedClient || 'CONTADO',
      nombreCliente: cl ? cl.nombre : 'Cliente Contado',"""
new_checkout = """    const cl = clients.find(c => c.nif === selectedClient || c.nombre === clientName)
    
    const payload = {
      vendedor: 'Sistema',
      nifCliente: selectedClient || (cl ? cl.nif : 'CONTADO'),
      nombreCliente: clientName || (cl ? cl.nombre : 'Cliente Contado'),"""
content = content.replace(old_checkout, new_checkout)

# 3. Update Cart Input UI
old_cart_ui = """                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Cliente (NIF opcional)</label>
                  <input type="text" value={selectedClient} onChange={e => setSelectedClient(e.target.value)} placeholder="Ej: 12345678Z" style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Vendedor</label>
                  <input type="text" value={saleVendedor} onChange={e => setSaleVendedor(e.target.value)} placeholder="Ej: Marta" style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', marginTop: 4 }} />
                </div>"""

new_cart_ui = """                <div style={{ marginBottom: 16, position: 'relative' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>NIF/CIF Opcional</label>
                      <input 
                        type="text" 
                        value={selectedClient} 
                        onChange={e => {
                          setSelectedClient(e.target.value);
                          setShowSuggestions(true);
                          const match = clients.find(c => c.nif.toLowerCase().includes(e.target.value.toLowerCase()));
                          if (match && e.target.value.length > 2) setClientName(match.nombre);
                        }} 
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="Ej: 12345678Z" 
                        maxLength={9}
                        style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', marginTop: 4 }} 
                      />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Nombre Cliente</label>
                      <input 
                        type="text" 
                        value={clientName} 
                        onChange={e => {
                          setClientName(e.target.value);
                          setShowSuggestions(true);
                          const match = clients.find(c => c.nombre.toLowerCase().includes(e.target.value.toLowerCase()));
                          if (match && e.target.value.length > 2) setSelectedClient(match.nif);
                        }} 
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="Ej: Juan Pérez" 
                        style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', marginTop: 4 }} 
                      />
                    </div>
                  </div>
                  
                  {/* Autocomplete Dropdown */}
                  {showSuggestions && (selectedClient.length > 1 || clientName.length > 1) && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #eee', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 150, overflowY: 'auto', marginTop: 4 }}>
                      {clients
                        .filter(c => (selectedClient && c.nif.toLowerCase().includes(selectedClient.toLowerCase())) || (clientName && c.nombre.toLowerCase().includes(clientName.toLowerCase())))
                        .slice(0, 5)
                        .map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => {
                              setSelectedClient(c.nif);
                              setClientName(c.nombre);
                              setShowSuggestions(false);
                            }}
                            style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f8f9fa', display: 'flex', justifyContent: 'space-between' }}
                          >
                            <strong style={{ color: '#E91E97', fontSize: 13 }}>{c.nif}</strong>
                            <span style={{ fontSize: 13, color: '#333' }}>{c.nombre}</span>
                          </div>
                      ))}
                      {clients.filter(c => (selectedClient && c.nif.toLowerCase().includes(selectedClient.toLowerCase())) || (clientName && c.nombre.toLowerCase().includes(clientName.toLowerCase()))).length === 0 && (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: '#888', textAlign: 'center' }}>
                          Nuevo cliente (se usará el nombre escrito)
                        </div>
                      )}
                    </div>
                  )}
                </div>"""

content = content.replace(old_cart_ui, new_cart_ui)

# 4. Hide suggestions when clicking outside
# A simple way to hide suggestions is just to let them be open while typing and clicking an option closes it.
# We also have maxLength={9} added to NIF in the cart UI.

# 5. Add maxLength={9} to Clientes Tab
content = content.replace(
    """<input placeholder="12345678Z" value={newClient.nif} onChange={e=>setNewClient({...newClient, nif: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />""",
    """<input placeholder="12345678Z" value={newClient.nif} maxLength={9} onChange={e=>setNewClient({...newClient, nif: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />"""
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated POS with client autocomplete and max length 9")
