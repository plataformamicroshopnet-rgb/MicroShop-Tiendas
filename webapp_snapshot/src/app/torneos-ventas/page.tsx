'use client'

import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Trophy } from 'lucide-react'
import { useComisionesData } from '@/hooks/useComisionesData'

const getMedal = (pos: number) => {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return pos;
}

const getRowStyle = (pos: number) => {
  if (pos === 1) return { backgroundColor: '#ffd700', fontWeight: 'bold' };
  if (pos === 2) return { backgroundColor: '#e0e0e0', fontWeight: 'bold' };
  if (pos === 3) return { backgroundColor: '#cd7f32', fontWeight: 'bold' };
  return { backgroundColor: '#ffffff' };
}

const ChartBars = ({ data, maxValue, barColor }: { data: any[], maxValue: number, barColor: string }) => {
  return (
    <div style={{ backgroundColor: '#f1f5f9', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0, minHeight: 250, border: '1px solid #e2e8f0' }}>
      {data.map((item) => {
        // Handle max 0 case safely
        const percentage = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 5) : 5;
        return (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '60px', color: '#1e293b', fontSize: '11px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
              {item.name}
            </div>
            <div style={{ flex: 1, position: 'relative', height: '22px' }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${percentage}%`,
                backgroundColor: barColor,
                borderRadius: '0 4px 4px 0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: '8px'
              }}>
                <span style={{ color: '#fff', fontSize: '10px', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {item.label}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function TorneosVentasPage() {
  const { sellerStats, loading } = useComisionesData();
  const [trofeos, setTrofeos] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem('torneos_ventas_trofeos');
      if (stored) setTrofeos(JSON.parse(stored));
    } catch (e) {
      console.error("Error loading trofeos", e);
    }
  }, []);

  const handleTrofeoChange = (colKey: string, pos: number, val: string) => {
    const newTrofeos = { ...trofeos, [`${colKey}-${pos}`]: val };
    setTrofeos(newTrofeos);
    localStorage.setItem('torneos_ventas_trofeos', JSON.stringify(newTrofeos));
  }

  if (loading) {
    return (
      <div className="w-full" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: 40, textAlign: 'center', color: '#3b82f6', fontWeight: 600 }}>
        <Trophy size={48} className="mx-auto animate-pulse" />
        <p className="mt-4">Cargando Torneos y procesando datos en tiempo real...</p>
      </div>
    );
  }

  // Calculate Data
  let arr1 = sellerStats.map(s => {
    let val = 0;
    s.rawSales.forEach((rs: any) => {
      const cat = rs.categoria || rs.detalle || rs.sheet || '';
      if (cat === 'RENT' || cat === 'Seguro') {
        let cuota = Number(rs.cuota) || 0;
        val += cuota;
      }
    });
    return { name: s.name, value: val };
  });

  let arr2 = sellerStats.map(s => {
    let val = 0;
    s.rawSales.forEach((rs: any) => {
      const cat = rs.categoria || rs.detalle || rs.sheet || '';
      const prod = rs.producto || '';
      if (cat === 'Repos' && !prod.includes('Fútbol')) {
        let cuota = Number(rs.cuota) || 0;
        val += cuota;
      }
    });
    return { name: s.name, value: val };
  });

  let arr3 = sellerStats.map(s => {
    let count = 0;
    s.rawSales.forEach((rs: any) => {
      const cat = rs.categoria || rs.detalle || rs.sheet || '';
      if (cat === 'miMovistar') {
        count++;
      }
    });
    return { name: s.name, value: count };
  });

  const fmt = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const processCol = (arr: any[], isCurrency: boolean) => {
    const sorted = [...arr].sort((a, b) => b.value - a.value);
    return sorted.map((item, idx) => ({
      pos: idx + 1,
      name: item.name,
      value: item.value,
      label: isCurrency ? fmt(item.value) : String(item.value)
    }));
  };

  const dataCol1 = processCol(arr1, true);
  const dataCol2 = processCol(arr2, true);
  const dataCol3 = processCol(arr3, false);

  const max1 = Math.max(...dataCol1.map(d => d.value), 0);
  const max2 = Math.max(...dataCol2.map(d => d.value), 0);
  const max3 = Math.max(...dataCol3.map(d => d.value), 0);

  return (
    <div className="w-full" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '24px 0 40px' }}>
      <PageHeader
        title={<><Trophy color="#eab308" size={28} /> Torneos de Ventas</>}
        subtitle="Ranking en tiempo real, competición y medallas por objetivos."
        showBack={true}
      />

      <div style={{ padding: '24px 32px 0' }}>
        <style dangerouslySetInnerHTML={{
          __html: `
          .torneo-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          .torneo-table th {
            color: white;
            font-weight: bold;
            padding: 12px 8px;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.2);
            height: 57px; /* Fija la altura para igualar entre tablas */
          }
          .torneo-table td {
            padding: 2px 8px;
            text-align: center;
            border: 1px solid #e2e8f0;
            color: #1e293b;
            height: 28px; /* Fija la altura de las filas */
          }
          .header-blue { background-color: #3b82f6; }
          .header-green { background-color: #65a30d; }
          .header-orange { background-color: #f97316; }

          .grid-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px; /* Espacio limpio entre tablas */
          }
          
          .trofeo-input {
            width: 100%;
            height: 100%;
            background: transparent;
            border: none;
            outline: none;
            text-align: center;
            font-size: 14px;
            font-weight: 600;
            color: inherit;
            cursor: pointer;
          }
          .trofeo-input:focus {
            cursor: text;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 4px;
          }
          .trofeo-input::placeholder {
            color: rgba(30, 41, 59, 0.3);
            font-weight: normal;
          }
        `}} />

        <div style={{ backgroundColor: '#fff', overflow: 'hidden' }}>
          {/* TABLAS */}
          <div className="grid-container">
            {/* Col 1 */}
            <div>
              <table className="torneo-table">
                <thead>
                  <tr className="header-blue">
                    <th style={{ width: '15%' }}>Posición</th>
                    <th style={{ width: '25%' }}>Trofeo</th>
                    <th style={{ width: '30%' }}>Vendedor</th>
                    <th style={{ width: '30%' }}>Dispositivos + Seguros</th>
                  </tr>
                </thead>
                <tbody>
                  {dataCol1.map(row => (
                    <tr key={row.name} style={getRowStyle(row.pos)}>
                      <td style={{ fontSize: row.pos <= 3 ? '20px' : '14px' }}>{getMedal(row.pos)}</td>
                      <td>
                        <input
                          type="text"
                          className="trofeo-input"
                          placeholder="-"
                          value={trofeos[`col1-${row.pos}`] || ''}
                          onChange={(e) => handleTrofeoChange('col1', row.pos, e.target.value)}
                        />
                      </td>
                      <td>{row.name}</td>
                      <td>{row.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Col 2 */}
            <div>
              <table className="torneo-table">
                <thead>
                  <tr className="header-green">
                    <th style={{ width: '15%' }}>Posición</th>
                    <th style={{ width: '25%' }}>Trofeo</th>
                    <th style={{ width: '30%' }}>Vendedor</th>
                    <th style={{ width: '30%' }}>Total ARPU €</th>
                  </tr>
                </thead>
                <tbody>
                  {dataCol2.map(row => (
                    <tr key={row.name} style={getRowStyle(row.pos)}>
                      <td style={{ fontSize: row.pos <= 3 ? '20px' : '14px' }}>{getMedal(row.pos)}</td>
                      <td>
                        <input
                          type="text"
                          className="trofeo-input"
                          placeholder="-"
                          value={trofeos[`col2-${row.pos}`] || ''}
                          onChange={(e) => handleTrofeoChange('col2', row.pos, e.target.value)}
                        />
                      </td>
                      <td>{row.name}</td>
                      <td>{row.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Col 3 */}
            <div>
              <table className="torneo-table">
                <thead>
                  <tr className="header-orange">
                    <th style={{ width: '15%' }}>Posición</th>
                    <th style={{ width: '25%' }}>Trofeo</th>
                    <th style={{ width: '30%' }}>Vendedor</th>
                    <th style={{ width: '30%' }}>Alta BAF Convergente</th>
                  </tr>
                </thead>
                <tbody>
                  {dataCol3.map(row => (
                    <tr key={row.name} style={getRowStyle(row.pos)}>
                      <td style={{ fontSize: row.pos <= 3 ? '20px' : '14px' }}>{getMedal(row.pos)}</td>
                      <td>
                        <input
                          type="text"
                          className="trofeo-input"
                          placeholder="-"
                          value={trofeos[`col3-${row.pos}`] || ''}
                          onChange={(e) => handleTrofeoChange('col3', row.pos, e.target.value)}
                        />
                      </td>
                      <td>{row.name}</td>
                      <td>{row.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* GRÁFICOS */}
          <div className="grid-container" style={{ marginTop: 2 }}>
            <ChartBars data={dataCol1} maxValue={max1} barColor="#3b82f6" />
            <ChartBars data={dataCol2} maxValue={max2} barColor="#65a30d" />
            <ChartBars data={dataCol3} maxValue={max3} barColor="#f97316" />
          </div>

        </div>
      </div>
    </div>
  )
}
