import os

os.makedirs('src/app/movilfree/print/[id]', exist_ok=True)

print_page_code = """import { PrismaClient } from '@prisma/client'
import { notFound } from 'next/navigation'

const prisma = new PrismaClient()

export default async function PrintInvoice({ params, searchParams }: { params: { id: string }, searchParams: { type: string } }) {
  // Fix Next.js 15 async params
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const resolvedSearchParams = await searchParams;
  const type = resolvedSearchParams.type || 'ticket';

  const sale = await prisma.movilFreeSale.findUnique({ where: { id: id } })
  if (!sale) return notFound()

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
      <html>
        <head>
          <title>Ticket #{sale.numeroFactura || '---'}</title>
          <style>{`
            @media print {
              @page { margin: 0; }
              body { margin: 0; }
            }
            body { font-family: monospace; padding: 10px; margin: 0 auto; width: 300px; color: black; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .separator { border-bottom: 1px dashed black; margin: 10px 0; }
            .table-totals { width: 100%; text-align: right; }
          `}</style>
        </head>
        <body onLoad={() => window.print()}>
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
        </body>
      </html>
    )
  }

  // A4 FACTURA
  return (
    <html>
      <head>
        <title>Factura #{sale.numeroFactura || '---'}</title>
        <style>{`
          @media print {
            @page { margin: 1cm; size: A4 portrait; }
            body { margin: 0; }
          }
          body { font-family: 'Arial', sans-serif; padding: 40px; margin: 0 auto; max-width: 800px; color: #333; }
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
        `}</style>
      </head>
      <body onLoad={() => window.print()}>
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
      </body>
    </html>
  )
}
"""

with open('src/app/movilfree/print/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(print_page_code)

print("Created Print Route")
