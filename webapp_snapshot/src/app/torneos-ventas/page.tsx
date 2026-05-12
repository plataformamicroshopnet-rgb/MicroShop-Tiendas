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

const getRowClass = (pos: number) => {
  if (pos === 1) return 'row-oro';
  if (pos === 2) return 'row-plata';
  if (pos === 3) return 'row-bronce';
  return 'row-normal';
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
  const validSellers = sellerStats.filter(s => s.name !== 'Marta');

  let arr1 = validSellers.map(s => {
    let val = 0;
    s.rawSales.forEach((rs: any) => {
      const cat = rs.categoria || rs.detalle || rs.sheet || '';
      if (cat === 'Rent' || cat === 'Seguro') {
        let cuota = Number(rs.cuota) || 0;
        val += cuota;
      }
    });
    return { name: s.name, value: val };
  });

  let arr2 = validSellers.map(s => {
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

  let arr3 = validSellers.map(s => {
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

      <div style={{ padding: '0px 32px 0' }}>
        <style dangerouslySetInnerHTML={{
          __html: `
          .torneo-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0 2px;
            font-size: 14px;
          }
          .torneo-table th {
            color: #64748b;
            font-weight: 800;
            padding: 8px 8px;
            text-align: center;
            vertical-align: bottom;
            border-bottom: 3px solid #e2e8f0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 12px;
            height: 52px;
          }
          .torneo-table td {
            padding: 2px 8px;
            text-align: center;
            color: #334155;
            border: none;
            background: #ffffff;
            transition: all 0.2s ease;
            height: 28px;
          }
          
          .torneo-row td:first-child { border-top-left-radius: 10px; border-bottom-left-radius: 10px; }
          .torneo-row td:last-child { border-top-right-radius: 10px; border-bottom-right-radius: 10px; }

          .torneo-row {
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          }
          .torneo-row:hover td {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.08);
            z-index: 10;
            position: relative;
          }

          .header-blue th { border-bottom-color: #3b82f6; }
          .header-green th { border-bottom-color: #10b981; }
          .header-orange th { border-bottom-color: #f97316; }

          .grid-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            padding: 16px 20px;
            background: #f8fafc;
            border-radius: 16px;
          }

          .row-oro td {
            background: linear-gradient(90deg, rgba(250,204,21,0.06) 0%, rgba(250,204,21,0.18) 100%);
            font-weight: 800;
            color: #854d0e;
          }
          .row-oro td:first-child { border-left: 5px solid #eab308; }

          .row-plata td {
            background: linear-gradient(90deg, rgba(148,163,184,0.05) 0%, rgba(148,163,184,0.15) 100%);
            font-weight: 800;
            color: #334155;
          }
          .row-plata td:first-child { border-left: 5px solid #94a3b8; }

          .row-bronce td {
            background: linear-gradient(90deg, rgba(180,83,9,0.04) 0%, rgba(180,83,9,0.12) 100%);
            font-weight: 800;
            color: #78350f;
          }
          .row-bronce td:first-child { border-left: 5px solid #d97706; }
          
          .row-normal td { 
            border-bottom: 1px solid #f1f5f9; 
            border-top: 1px solid #f1f5f9; 
          }

          .trofeo-input {
            width: 100%;
            height: 24px;
            background: transparent;
            border: 1px solid transparent;
            outline: none;
            text-align: center;
            font-size: 13px;
            font-weight: 600;
            color: inherit;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.2s;
          }
          .trofeo-input:hover {
            background: rgba(255,255,255,0.6);
          }
          .trofeo-input:focus {
            cursor: text;
            background: #fff;
            border: 1px solid #cbd5e1;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            color: #1e293b;
          }
          .trofeo-input::placeholder {
            color: rgba(100, 116, 139, 0.4);
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
                    <tr key={row.name} className={`torneo-row ${getRowClass(row.pos)}`}>
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
                    <tr key={row.name} className={`torneo-row ${getRowClass(row.pos)}`}>
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
                    <tr key={row.name} className={`torneo-row ${getRowClass(row.pos)}`}>
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
