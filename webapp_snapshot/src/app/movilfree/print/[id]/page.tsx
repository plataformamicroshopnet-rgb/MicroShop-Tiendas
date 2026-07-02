import AutoPrint from '@/components/AutoPrint'
import { PrismaClient } from '@prisma/client'
import { notFound } from 'next/navigation'

const prisma = new PrismaClient()

export default async function PrintInvoice({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ type: string }> }) {
  // Fix Next.js 15 async params
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  const sale = await prisma.movilFreeSale.findUnique({ where: { id: id } })
  if (!sale) return notFound()

  const resolvedSearchParams = await searchParams;
  const type = resolvedSearchParams.type || sale.tipoDocumento || 'ticket';

  // We need Client data if it's a Factura (A4)
  let client = null;
  if (type === 'factura' && sale.nifCliente && sale.nifCliente !== 'CONTADO') {
    client = await prisma.movilFreeClient.findUnique({ where: { nif: sale.nifCliente } })
  }

  const items = JSON.parse(sale.listaProductos)
  
  // Calculations
  const subtotal = sale.importeTotal / 1.21;
  const taxes = sale.importeTotal - subtotal;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  if (type === 'ticket') {
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
        <AutoPrint />
        
        <div className="center">
          <img src="/images/media__1778608332264.png" style={{ width: 150, marginBottom: 10 }} />
          <div className="bold">MICRO-INFOR SALAMANCA, S.L.</div>
          <div>C.I.F.: B-37290293</div>
          <div>C/ ALARCÓN, 2 BAJO</div>
          <div>37007-SALAMANCA TLF:923214407</div>
        </div>
        
        <div className="separator"></div>
        <div className="center bold">
          {sale.tipoDocumento === 'factura' ? `FACTURA #${sale.facturaSerie || '---'}` : `FACTURA SIMPLIFICADA #${sale.numeroFactura || '---'}`}
        </div>
        <div className="separator"></div>

        <div>
          {items.map((i: any, idx: number) => (
            <div className="item-row" key={idx}>
              <div style={{ flex: 1, paddingRight: 10 }}>
                {i.cantidad}x {i.nombre}
                {i.imei ? <div style={{ fontSize: 11 }}>IMEI: {i.imei}</div> : null}
              </div>
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
          <div>FORMA DE PAGO: <strong>{sale.metodoPago || 'Efectivo'}</strong></div>
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
  }

  // A4 FACTURA (MODERN DESIGN)
  return (
    <div id="print-section" style={{ background: 'white', padding: '40px 60px', minHeight: '100vh', color: '#2d3748', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { position: absolute; left: 0; top: 0; margin: 0; padding: 40px !important; width: 100%; box-sizing: border-box; }
          @page { margin: 0; size: A4 portrait; }
        }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        #print-section { max-width: 800px; margin: 0 auto; }
        
        /* Modern Header Grid */
        .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 50px; border-bottom: 2px solid #f0f0f0; padding-bottom: 30px; }
        .company-info { color: #718096; font-size: 13px; line-height: 1.6; }
        .company-info strong { color: #2d3748; font-weight: 600; }
        .invoice-title-block { text-align: right; }
        .invoice-title-block h1 { margin: 0 0 10px 0; color: #E91E97; font-size: 36px; font-weight: 800; letter-spacing: -1px; text-transform: uppercase; }
        .invoice-meta { display: grid; grid-template-columns: auto auto; gap: 8px 24px; text-align: right; font-size: 14px; color: #4a5568; }
        .invoice-meta strong { color: #2d3748; }

        /* Client Block */
        .client-block { background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 40px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
        .client-block h3 { margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #a0aec0; font-weight: 600; }
        .client-details { font-size: 14px; line-height: 1.7; color: #2d3748; }
        .client-details strong { font-weight: 600; }

        /* Modern Table */
        .modern-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 40px; }
        .modern-table th { background: #fff5f9; color: #E91E97; font-weight: 600; text-transform: uppercase; font-size: 12px; padding: 14px 16px; text-align: left; letter-spacing: 0.5px; border-bottom: 2px solid #fdd8e7; }
        .modern-table th.text-right { text-align: right; }
        .modern-table td { padding: 16px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #4a5568; }
        .modern-table td.text-right { text-align: right; }
        .modern-table tr:last-child td { border-bottom: none; }
        .modern-table tbody tr:nth-child(even) { background: #fafafa; }

        /* Totals Block */
        .totals-wrapper { display: flex; justify-content: flex-end; margin-bottom: 50px; }
        .totals-block { width: 320px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .totals-row { display: flex; justify-content: space-between; padding: 12px 20px; font-size: 14px; color: #4a5568; border-bottom: 1px solid #edf2f7; }
        .totals-row.grand-total { background: #E91E97; color: white; border-bottom: none; font-size: 18px; font-weight: 800; padding: 18px 20px; }

        /* Legal Footer */
        .legal-footer { border-top: 1px solid #e2e8f0; padding-top: 24px; font-size: 10px; color: #a0aec0; text-align: justify; line-height: 1.5; }
        .legal-footer strong { color: #718096; display: block; text-align: center; margin-top: 16px; font-size: 11px; }
      `}} />
      <script dangerouslySetInnerHTML={{ __html: 'setTimeout(function() { window.print(); }, 500);' }} />

      {/* HEADER SECTION */}
      <div className="invoice-header">
        <div>
          <img src="/images/media__1778608332264.png" alt="Movilfree" style={{ height: '70px', marginBottom: '16px' }} />
          <div className="company-info">
            <strong>Micro-Infor Salamanca, S.L.</strong><br/>
            C.I.F.: B37290293<br/>
            C/ Alarcón, 2 Bajo<br/>
            37007 - Salamanca<br/>
            TLF: 923 214 407
          </div>
        </div>
        <div className="invoice-title-block">
          <h1>{sale.tipoDocumento === 'factura' ? 'FACTURA' : 'FACTURA SIMPLIFICADA'}</h1>
          <div className="invoice-meta">
            <span>Número:</span>
            <strong>{sale.tipoDocumento === 'factura' ? (sale.facturaSerie || '---') : `#${sale.numeroFactura || '---'}`}</strong>
            <span>Fecha:</span>
            <strong>{formatDate(sale.fechaVenta)}</strong>
            <span>Forma de pago:</span>
            <strong>{sale.metodoPago || 'Efectivo'}</strong>
          </div>
        </div>
      </div>

      {/* CLIENT SECTION */}
      <div className="client-block">
        <div>
          <h3>Facturado a:</h3>
          <div className="client-details">
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#E91E97', marginBottom: '4px' }}>{client ? client.nombre : sale.nombreCliente}</div>
            <div><strong>NIF/CIF:</strong> {client ? client.nif : sale.nifCliente}</div>
            {client && client.direccion && <div>{client.direccion}</div>}
            {client && (client.cp || client.poblacion || client.provincia) && (
              <div>{client.cp || ''} {client.poblacion || ''} {client.provincia ? `(${client.provincia})` : ''}</div>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h3>Contacto:</h3>
          <div className="client-details">
            <div>{client ? (client.movil || client.fijo || '---') : '---'}</div>
            <div>{client ? (client.email || '---') : '---'}</div>
          </div>
        </div>
      </div>

      {/* PRODUCTS TABLE */}
      <table className="modern-table">
        <thead>
          <tr>
            <th>Descripción</th>
            <th className="text-right">Precio Ud.</th>
            <th className="text-right">Cant.</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i: any, idx: number) => (
            <tr key={idx}>
              <td>
                <strong>{i.nombre}</strong>
                {i.imei ? <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>IMEI: {i.imei}</div> : null}
              </td>
              <td className="text-right">{i.precio.toFixed(2)} €</td>
              <td className="text-right">{i.cantidad}</td>
              <td className="text-right" style={{ fontWeight: '600', color: '#2d3748' }}>{(i.cantidad * i.precio).toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TOTALS SECTION */}
      <div className="totals-wrapper">
        <div className="totals-block">
          <div className="totals-row">
            <span>Base Imponible</span>
            <strong>{subtotal.toFixed(2)} €</strong>
          </div>
          <div className="totals-row">
            <span>IVA (21%)</span>
            <strong>{taxes.toFixed(2)} €</strong>
          </div>
          <div className="totals-row grand-total">
            <span>TOTAL FACTURA</span>
            <span>{sale.importeTotal.toFixed(2)} €</span>
          </div>
        </div>
      </div>

      {/* FOOTER SECTION */}
      <div className="legal-footer">
        1.- Los datos de carácter personal serán tratados por MICRO INFOR SALAMANCA S.L. con la finalidad de gestionar la relación contractual, administrativa y contable. 
        2.- Para el ejercicio de los derechos de acceso, rectificación, supresión y portabilidad, puede dirigirse por escrito a la dirección de la empresa. 
        3.- En aplicación del R.D. Legislativo 1/2007 el consumidor dispone de un plazo de dos años de garantía legal sobre bienes de naturaleza duradera. 
        4.- La garantía recae sobre el producto que consta en esta factura, siendo imprescindible su presentación para cualquier reclamación. 
        5.- El comprador tiene a su disposición Hojas de Reclamaciones Oficiales según el modelo de la Junta de Castilla y León.
        <strong>** CONSERVE ESTA FACTURA PARA EFECTUAR DEVOLUCIONES O TRAMITAR GARANTÍAS **</strong>
      </div>
    </div>
  )
}
