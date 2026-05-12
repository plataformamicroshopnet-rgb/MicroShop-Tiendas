import re

filepath = 'src/app/movilfree/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Update Client Type
content = content.replace(
    'type Client = { id: string; nif: string; nombre: string; telefono: string; email: string; totalComprado: number }',
    'type Client = { id: string; nif: string; nombre: string; direccion?: string; poblacion?: string; provincia?: string; cp?: string; movil?: string; fijo?: string; email: string; totalComprado: number }'
)

# Update state
content = content.replace(
    "const [newClient, setNewClient] = useState({ nif: '', nombre: '', telefono: '', email: '' })",
    "const [newClient, setNewClient] = useState({ nif: '', nombre: '', direccion: '', poblacion: '', provincia: '', cp: '', movil: '', fijo: '', email: '' })"
)

# Update reset inside handleCreateClient
content = content.replace(
    "setNewClient({ nif: '', nombre: '', telefono: '', email: '' })",
    "setNewClient({ nif: '', nombre: '', direccion: '', poblacion: '', provincia: '', cp: '', movil: '', fijo: '', email: '' })"
)

# Fix the TAB: CLIENTES section
new_clients_tab = """          {/* TAB: CLIENTES */}
          {activeTab === 'clientes' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24, background: '#f8f9fa', padding: 16, borderRadius: 12, alignItems: 'end' }}>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>DNI/CIF</label>
                  <input placeholder="12345678Z" value={newClient.nif} onChange={e=>setNewClient({...newClient, nif: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Nombre</label>
                  <input placeholder="Nombre completo" value={newClient.nombre} onChange={e=>setNewClient({...newClient, nombre: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Dirección</label>
                  <input placeholder="Calle, número, piso..." value={newClient.direccion} onChange={e=>setNewClient({...newClient, direccion: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Población</label>
                  <input placeholder="Población" value={newClient.poblacion} onChange={e=>setNewClient({...newClient, poblacion: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Provincia</label>
                  <input placeholder="Provincia" value={newClient.provincia} onChange={e=>setNewClient({...newClient, provincia: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>C.P.</label>
                  <input placeholder="Código Postal" value={newClient.cp} onChange={e=>setNewClient({...newClient, cp: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Tlfn. Móvil</label>
                  <input placeholder="Móvil" value={newClient.movil} onChange={e=>setNewClient({...newClient, movil: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Tlfn. Fijo</label>
                  <input placeholder="Fijo" value={newClient.fijo} onChange={e=>setNewClient({...newClient, fijo: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{fontSize: 12, fontWeight: 'bold', color: '#666'}}>Email</label>
                  <input type="email" placeholder="correo@..." value={newClient.email} onChange={e=>setNewClient({...newClient, email: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
                </div>
                <button onClick={handleCreateClient} style={{ background: '#E91E97', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', height: 40 }}>Registrar Cliente</button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#FFF0F9', color: '#E91E97' }}>
                    <th style={{ padding: 12, borderRadius: '8px 0 0 8px' }}>NIF</th>
                    <th style={{ padding: 12 }}>Nombre</th>
                    <th style={{ padding: 12 }}>Contacto</th>
                    <th style={{ padding: 12 }}>Ubicación</th>
                    <th style={{ padding: 12, borderRadius: '0 8px 8px 0' }}>Total Comprado</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 12, fontWeight: 'bold', color: '#555' }}>{c.nif}</td>
                      <td style={{ padding: 12, fontWeight: 'bold' }}>{c.nombre}</td>
                      <td style={{ padding: 12, color: '#666' }}>
                        {c.movil && <div>📱 {c.movil}</div>}
                        {c.fijo && <div>📞 {c.fijo}</div>}
                        {c.email && <div>✉️ {c.email}</div>}
                      </td>
                      <td style={{ padding: 12, color: '#666' }}>
                        <div>{c.direccion || '-'}</div>
                        <div>{c.cp || ''} {c.poblacion || ''} {c.provincia ? `(${c.provincia})` : ''}</div>
                      </td>
                      <td style={{ padding: 12, color: '#E91E97', fontWeight: 'bold', fontSize: 16 }}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(c.totalComprado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}"""

content = re.sub(
    r"          \{\/\* TAB: CLIENTES \*\/\}.*?(?=\s*\{\/\* TAB: DEVOLUCIONES)",
    new_clients_tab,
    content,
    flags=re.DOTALL
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Clients tab")
