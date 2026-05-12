import re

filepath = 'src/app/movilfree/print/[id]/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the Ticket layout
ticket_layout = """  if (type === 'ticket') {
    return (
      <div id="print-section" style={{ background: 'white', padding: 10, minHeight: '100vh', color: 'black' }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden; }
            #print-section, #print-section * { visibility: visible; }
            #print-section { position: absolute; left: 0; top: 0; margin: 0; padding: 0; width: 100%; }
            @page { margin: 0; }
          }
          #print-section { font-family: monospace; margin: 0 auto; width: 300px; color: black; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .item-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .separator { border-bottom: 1px dashed black; margin: 10px 0; }
          .table-totals { width: 100%; text-align: right; }
        `}} />
        <script dangerouslySetInnerHTML={{ __html: 'setTimeout(function() { window.print(); }, 500);' }} />
        
        <div className="center">
          <img src="/images/media__1778608332264.png" style={{ width: 150, marginBottom: 10 }} />
          <div className="bold">MICRO-INFOR SALAMANCA, S.L.</div>
          <div>C.I.F.: B-37290293</div>
          <div>C/ ALARCÓN, 2 BAJO</div>
          <div>37007-SALAMANCA TLF:923214407</div>
        </div>
        
        <div className="separator"></div>
        <div className="center bold">FACTURA SIMPLIFICADA #{sale.numeroFactura || '---'}</div>
        <div className="separator"></div>

        <div>
          {items.map((i: any, idx: number) => (
            <div className="item-row" key={idx}>
              <div style={{ flex: 1, paddingRight: 10 }}>{i.cantidad}x {i.nombre}</div>
              <div>{(i.cantidad * i.precio).toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="separator"></div>
        
        <table className="table-totals">
          <tbody>
            <tr>
              <td>SUBTOTAL SIN IMPUESTOS</td>
              <td>{subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td>I.V.A. (21%)</td>
              <td>{taxes.toFixed(2)}</td>
            </tr>
            <tr className="bold" style={{ fontSize: 16 }}>
              <td>TOTAL FACTURA EUR</td>
              <td>{sale.importeTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 20 }}>
          <div>FORMA DE PAGO: Efectivo / Tarjeta</div>
          <div>FECHA: {formatDate(sale.fechaVenta)}</div>
        </div>

        <div className="separator"></div>
        <div className="center" style={{ fontSize: 11 }}>
          CONDICIONES DE COMPRA SEGÚN LEY EN VIGENCIA RDL 1/2007<br/>
          PLAZO DEVOLUCIÓN: 7 DÍAS HÁBILES<br/>
          SE ABONARÁ EL IMPORTE EN FORMA DE VALE DESCUENTO.<br/>
          **CONSERVE ESTE TICKET PARA DEVOLUCIONES O GARANTÍAS**
        </div>
      </div>
    )
  }"""

content = re.sub(
    r"  if \(type === 'ticket'\) \{.*?    \)\n  \}",
    ticket_layout,
    content,
    flags=re.DOTALL
)


factura_layout = """  // A4 FACTURA
  return (
    <div id="print-section" style={{ background: 'white', padding: 40, minHeight: '100vh', color: '#333' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { position: absolute; left: 0; top: 0; margin: 0; padding: 0; width: 100%; }
          @page { margin: 1cm; size: A4 portrait; }
        }
        #print-section { font-family: 'Arial', sans-serif; margin: 0 auto; max-width: 800px; color: #333; }
        .header { text-align: center; margin-bottom: 40px; }
        .header img { height: 80px; margin-bottom: 10px; }
        .header p { margin: 2px 0; font-size: 14px; }
        .title { text-align: center; font-size: 24px; font-weight: bold; margin: 30px 0; letter-spacing: 2px; }
        .flex-between { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; }
        .section-title { text-align: center; font-weight: bold; text-decoration: underline; margin-bottom: 20px; font-size: 16px; }
        .client-box { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 14px; margin-bottom: 40px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        th, td { border: 1px solid #333; padding: 12px; text-align: center; }
        th { background: #f4f4f4; }
        .td-left { text-align: left; }
        .totals-table { width: 300px; margin-left: auto; }
        .legal { font-size: 9px; text-align: center; margin-top: 60px; color: #666; font-style: italic; }
      `}} />
      <script dangerouslySetInnerHTML={{ __html: 'setTimeout(function() { window.print(); }, 500);' }} />

      <div className="header">
        <img src="/images/media__1778608332264.png" alt="Movilfree" />
        <p><em>Micro-Infor Salamanca, S.L. C.I.F.: B37290293</em></p>
        <p><em>C/ Alarcón, 2. 37007 - Salamanca. TLF: 923214407</em></p>
      </div>

      <div className="title">FACTURA</div>

      <div className="flex-between">
        <div>Fecha: {formatDate(sale.fechaVenta)}</div>
        <div>Número: #{sale.numeroFactura || '---'}</div>
        <div>Forma de pago: Efectivo / Tarjeta</div>
      </div>

      <div className="section-title">INFORMACIÓN DEL CLIENTE</div>
      
      <div className="client-box">
        <div>Nombre: {client ? client.nombre : sale.nombreCliente}</div>
        <div>DNI/CIF: {client ? client.nif : sale.nifCliente}</div>
        <div>Teléfono: {client ? (client.telefono || '---') : '---'}</div>
        <div>E-mail: {client ? (client.email || '---') : '---'}</div>
      </div>

      <div className="section-title">PRODUCTOS</div>

      <table>
        <thead>
          <tr>
            <th className="td-left">Descripción</th>
            <th>Precio</th>
            <th>Ud</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i: any, idx: number) => (
            <tr key={idx}>
              <td className="td-left">{i.nombre}</td>
              <td>{i.precio.toFixed(2)}</td>
              <td>{i.cantidad}</td>
              <td>{(i.cantidad * i.precio).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="totals-table">
        <thead>
          <tr>
            <th>Subtotal</th>
            <th>IVA (21%)</th>
            <th>Total EUR</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{subtotal.toFixed(2)}</td>
            <td>{taxes.toFixed(2)}</td>
            <td style={{ fontWeight: 'bold' }}>{sale.importeTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div className="legal">
        1.- Los datos de carácter personal serán tratados por MICRO INFOR SALAMANCA S.L. con la finalidad de gestionar la relación contractual...<br/>
        2.- Para el ejercicio de los derechos de acceso, rectificación, supresión...<br/>
        3.- En aplicación del R.D. Legislativo 1/2007 el consumidor dispone de un plazo de dos años de garantía legal...<br/>
        4.- La garantía recae sobre el producto que consta en esta factura.<br/>
        5.- El comprador tiene a su disposición Hojas de Reclamaciones Oficiales...<br/>
        <strong style={{ fontSize: 11, color: 'black', fontStyle: 'normal', marginTop: 10, display: 'block' }}>**CONSERVE ESTA FACTURA PARA DEVOLUCIONES O GARANTÍAS**</strong>
      </div>
    </div>
  )
}"""

content = re.sub(
    r"  // A4 FACTURA\n  return \(\n    <html>.*?<\/html>\n  \)\n\}",
    factura_layout,
    content,
    flags=re.DOTALL
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed HTML inside main error")
