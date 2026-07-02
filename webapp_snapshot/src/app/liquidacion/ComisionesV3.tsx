import React, { useState, useEffect } from 'react';
import { Save, ClipboardList, Trash2, ArrowLeft, MessageSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { ExcelIcon } from '@/components/ActionIcons';

export function ComisionesV3({ activePeriodKey, canModify }: { activePeriodKey: string, canModify: boolean }) {
    const [localPeriod, setLocalPeriod] = useState<string>(activePeriodKey || '2026_05');
    const [comisiones, setComisiones] = useState<any[]>([]);
    const [titulo, setTitulo] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const generateDefaultTitle = (period: string) => {
        const [yearStr, monthStr] = period.split('_');
        if (!yearStr || !monthStr) return '';
        const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const currentMonthIndex = parseInt(monthStr) - 1;
        const payMonthIndex = (currentMonthIndex + 3) % 12;
        return `LIQUIDACIÓN DE VENTAS DE ${monthNames[currentMonthIndex]} SE PAGA EN LA NÓMINA DE ${monthNames[payMonthIndex]}`;
    };

    const fetchComisiones = async () => {
        if (!localPeriod) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/comisiones-ffvv-v3?periodKey=${localPeriod}`);
            const data = await res.json();
            if (data.success) {
                setComisiones(data.data);
                setTitulo(data.titulo || generateDefaultTitle(localPeriod));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComisiones();
    }, [localPeriod]);

    const cloneLegacy = async () => {
        if (!canModify) return alert("No tienes permisos o el periodo es histórico.");
        if (!window.confirm("¿Seguro que quieres clonar el mes anterior? Esto añadirá filas nuevas abajo.")) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/comisiones-ffvv-v3?legacyOnly=1`);
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                const clones = data.data.map((r: any, idx: number) => ({
                    ...r,
                    id: `temp_${Date.now()}_${idx}`,
                    periodId: undefined, // remove period
                    createdAt: undefined,
                    updatedAt: undefined
                }));
                setComisiones(clones);
            } else {
                alert("No se encontraron registros previos para clonar.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (index: number, field: string, value: string) => {
        if (!canModify) return;
        
        const isNumeric = field !== 'nombre' && field !== 'tipo';
        let finalVal: string | number | null = value;
        
        if (isNumeric) {
            const cleanVal = value.replace(',', '.');
            if (cleanVal === '') {
                finalVal = null;
            } else if (cleanVal.endsWith('.') || (cleanVal.includes('.') && cleanVal.endsWith('0'))) {
                finalVal = cleanVal;
            } else {
                finalVal = parseFloat(cleanVal);
                if (isNaN(finalVal)) finalVal = null;
            }
        }

        setComisiones(prev => {
            const arr = [...prev];
            arr[index] = { ...arr[index], [field]: finalVal };
            
            // Auto-calculate Total
            const row = arr[index];
            if (row.tipo === 'FFVV') {
                const total = (row.importe || 0) + (row.aceleradores || 0) - (row.descuentos || 0);
                arr[index].total = total;
                arr[index].incentivos = total - (row.dietas || 0) - (row.km || 0);
            } else if (row.tipo === 'TIENDA') {
                const total = (row.importe || 0) + (row.o2Varios || 0) - (row.descuentos || 0);
                arr[index].total = total;
            } else if (row.tipo === 'LOGISTICA') {
                const total = (row.importe || 0) + (row.gasolina || 0);
                arr[index].total = total;
                arr[index].incentivos = total - (row.dietas || 0) - (row.km || 0);
            }

            return arr;
        });
    };

    const handleNoteClick = (index: number, field: string) => {
        if (!canModify) return;
        const currentNote = comisiones[index][field] || '';
        const newNote = window.prompt("Editar nota:", currentNote);
        if (newNote !== null) {
            setComisiones(prev => {
                const arr = [...prev];
                arr[index] = { ...arr[index], [field]: newNote };
                return arr;
            });
        }
    };

    const renderNoteIcon = (index: number, noteField: string) => {
        const note = comisiones[index][noteField];
        const hasNote = !!note && String(note).trim() !== '';
        return (
            <button 
                title={hasNote ? note : "Añadir nota"}
                onClick={() => handleNoteClick(index, noteField)}
                style={{ 
                    background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', marginLeft: '4px',
                    color: hasNote ? '#f59e0b' : '#cbd5e1', display: 'flex', alignItems: 'center'
                }}
            >
                <MessageSquare size={14} fill={hasNote ? '#fef3c7' : 'none'} />
            </button>
        );
    };

    const addNewRow = (tipo: 'FFVV' | 'TIENDA' | 'LOGISTICA') => {
        if (!canModify) return;
        setComisiones(prev => [
            ...prev,
            { id: `temp_${Date.now()}_${Math.random()}`, tipo, nombre: '', importe: 0, aceleradores: 0, descuentos: 0, dietas: 0, km: 0, incentivos: 0, o2Varios: 0, gasolina: 0, total: 0 }
        ]);
    };

    const deleteRow = (id: string) => {
        if (!canModify) return;
        setComisiones(prev => prev.filter(r => r.id !== id));
        // Note: Real DB deletions are handled in save by sending missing IDs, or we can track deletions.
        // For simplicity, we just send all current rows and the backend will not see the missing ones.
        // Actually the backend PUT expects operations and deletions.
        // Let's track deletions!
        if (!id.startsWith('temp_')) {
            setDeletedIds(prev => [...prev, id]);
        }
    };
    
    const [deletedIds, setDeletedIds] = useState<string[]>([]);

    const saveChanges = async () => {
        if (!canModify) return alert("No tienes permisos o el periodo es histórico.");
        setSaving(true);
        try {
            const res = await fetch(`/api/comisiones-ffvv-v3?periodKey=${localPeriod}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    titulo,
                    operations: comisiones,
                    deletions: deletedIds
                })
            });
            if (res.ok) {
                alert("Guardado correctamente");
                setDeletedIds([]);
                fetchComisiones(); // Reload for real IDs
            } else {
                alert("Error al guardar.");
            }
        } catch (e) {
            console.error(e);
            alert("Error de red.");
        } finally {
            setSaving(false);
        }
    };

    const ffvvRows = comisiones.filter(r => r.tipo === 'FFVV');
    const tiendaRows = comisiones.filter(r => r.tipo === 'TIENDA');
    const logisticaRows = comisiones.filter(r => r.tipo === 'LOGISTICA');

    const totalFFVV = ffvvRows.reduce((sum, r) => sum + (r.total || 0), 0);
    const totalTiendas = tiendaRows.reduce((sum, r) => sum + (r.total || 0), 0);
    const totalLogistica = logisticaRows.reduce((sum, r) => sum + (r.total || 0), 0);

    // ── Exportar a Excel con los MISMOS colores/estilo de la pantalla ──────────────
    const exportExcel = async () => {
        const wb = new ExcelJS.Workbook();
        const sheet = wb.addWorksheet('Comisiones');
        sheet.columns = [{ width: 30 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
        const CUR = '#,##0.00" €";-#,##0.00" €";"-   €"';
        const num = (v: any) => Number(v) || 0;

        // Título (banda verde, como en pantalla)
        const tRow = sheet.addRow([titulo || generateDefaultTitle(localPeriod)]);
        sheet.mergeCells(tRow.number, 1, tRow.number, 8);
        tRow.height = 34;
        const tCell = tRow.getCell(1);
        tCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
        tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5CB85C' } };
        tCell.alignment = { vertical: 'middle', horizontal: 'center' };
        sheet.addRow([]);

        const addHeader = (labels: string[]) => {
            const row = sheet.addRow(labels);
            row.height = 26;
            for (let c = 1; c <= labels.length; c++) {
                const cell = row.getCell(c);
                cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } };
                cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' };
            }
        };
        // Fila de datos: cols = [{v, nota?, rojo?}] — 1ª col texto, resto moneda
        const addData = (cols: { v: any; nota?: string; rojo?: boolean }[], zebra: boolean) => {
            const row = sheet.addRow(cols.map(c => c.v));
            row.height = 24;
            cols.forEach((c, idx) => {
                const cell = row.getCell(idx + 1);
                cell.font = { name: 'Segoe UI', size: 10, color: { argb: c.rojo ? 'FFDC2626' : 'FF0F172A' }, bold: !!c.rojo };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra ? 'FFF0F9FF' : 'FFFFFFFF' } };
                cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
                cell.alignment = { vertical: 'middle', horizontal: idx > 0 ? 'right' : 'left' };
                if (idx > 0) cell.numFmt = CUR;
                if (c.nota && String(c.nota).trim()) cell.note = String(c.nota);
            });
        };
        const addTotal = (label: string, total: number, nCols: number) => {
            const vals: any[] = new Array(nCols).fill('');
            vals[0] = label; vals[nCols - 1] = total;
            const row = sheet.addRow(vals);
            row.height = 26;
            for (let c = 1; c <= nCols; c++) {
                const cell = row.getCell(c);
                cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF166534' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC1E1C1' } };
                cell.alignment = { vertical: 'middle', horizontal: c === nCols ? 'right' : 'left' };
                if (c === nCols) cell.numFmt = CUR;
            }
        };

        // FFVV
        addHeader(['FFVV', 'IMPORTE', 'VARIOS', 'DESCUENTOS', 'DIETAS', 'KM', 'INCENTIVOS', 'TOTAL']);
        ffvvRows.forEach((r, i) => addData([
            { v: r.nombre || '' }, { v: num(r.importe) },
            { v: num(r.aceleradores), nota: r.notasVarios },
            { v: num(r.descuentos), nota: r.notasDescuentos, rojo: num(r.descuentos) > 0 },
            { v: num(r.dietas), nota: r.notasDietas },
            { v: num(r.km), nota: r.notasKm },
            { v: num(r.incentivos) }, { v: num(r.total) },
        ], i % 2 === 1));
        addTotal('TOTAL FFVV', totalFFVV, 8);
        sheet.addRow([]);

        // TIENDAS
        addHeader(['TIENDAS', 'IMPORTE', 'O2 Y VARIOS', 'DESCUENTOS', 'TOTAL']);
        tiendaRows.forEach((r, i) => addData([
            { v: r.nombre || '' }, { v: num(r.importe) },
            { v: num(r.o2Varios), nota: r.notasVarios },
            { v: num(r.descuentos), nota: r.notasDescuentos, rojo: num(r.descuentos) > 0 },
            { v: num(r.total) },
        ], i % 2 === 1));
        addTotal('TOTAL TIENDAS', totalTiendas, 5);
        sheet.addRow([]);

        // LOGÍSTICA
        addHeader(['LOGÍSTICA', 'COMISIONES', 'GASOLINA', 'DIETAS', 'KM', 'INCENTIVOS', 'TOTAL']);
        logisticaRows.forEach((r, i) => addData([
            { v: r.nombre || '' }, { v: num(r.importe) }, { v: num(r.gasolina) },
            { v: num(r.dietas), nota: r.notasDietas },
            { v: num(r.km), nota: r.notasKm },
            { v: num(r.incentivos) }, { v: num(r.total) },
        ], i % 2 === 1));
        addTotal('TOTAL LOGÍSTICA', totalLogistica, 7);
        sheet.addRow([]);

        // TOTAL GENERAL (banda verde como en pantalla)
        const gRow = sheet.addRow(['TOTAL GENERAL (FFVV + TIENDAS + LOGÍSTICA)', '', '', '', '', '', '', totalFFVV + totalTiendas + totalLogistica]);
        sheet.mergeCells(gRow.number, 1, gRow.number, 7);
        gRow.height = 32;
        for (const c of [1, 8]) {
            const cell = gRow.getCell(c);
            cell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5CB85C' } };
            cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
            if (c === 8) cell.numFmt = CUR;
        }

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Comisiones_Tiendas_FFVV_v3_${localPeriod}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const actionControlStyle: React.CSSProperties = {
        height: 38,
        padding: '0 12px',
        fontSize: 14,
        border: 'none',
        borderRadius: 6,
        outline: 'none',
        background: '#0066cc',
        color: 'white',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        whiteSpace: 'nowrap',
        width: 'auto'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 22, color: 'var(--mercedes-cyan)', margin: 0 }}>Comisiones Tiendas y FFVV v3</h2>
                <div style={{ display: 'flex', gap: 12 }}>
                    <select 
                        className="form-select"
                        style={actionControlStyle}
                        value={localPeriod ? localPeriod.split('_')[1] : '05'}
                        onChange={e => setLocalPeriod(`${localPeriod ? localPeriod.split('_')[0] : '2026'}_${e.target.value}`)}
                    >
                        <option value="01">Enero</option>
                        <option value="02">Febrero</option>
                        <option value="03">Marzo</option>
                        <option value="04">Abril</option>
                        <option value="05">Mayo</option>
                        <option value="06">Junio</option>
                        <option value="07">Julio</option>
                        <option value="08">Agosto</option>
                        <option value="09">Septiembre</option>
                        <option value="10">Octubre</option>
                        <option value="11">Noviembre</option>
                        <option value="12">Diciembre</option>
                    </select>
                    <select 
                        className="form-select"
                        style={actionControlStyle}
                        value={localPeriod ? localPeriod.split('_')[0] : '2026'}
                        onChange={e => setLocalPeriod(`${e.target.value}_${localPeriod ? localPeriod.split('_')[1] : '05'}`)}
                    >
                        <option value="2024">2024</option>
                        <option value="2025">2025</option>
                        <option value="2026">2026</option>
                        <option value="2027">2027</option>
                    </select>
                    <button onClick={cloneLegacy} disabled={loading || !canModify} style={{ ...actionControlStyle, opacity: (loading || !canModify) ? 0.6 : 1 }}>
                        <ClipboardList size={16} /> Clonar Mes Anterior
                    </button>
                    {canModify && (
                        <select 
                            className="form-select"
                            style={actionControlStyle}
                            value=""
                            onChange={e => {
                                const val = e.target.value as 'FFVV' | 'TIENDA' | 'LOGISTICA' | '';
                                if (val) {
                                    if (window.confirm(`¿Añadir nueva fila en ${val === 'LOGISTICA' ? 'Varios donde Salva' : val}?`)) {
                                        addNewRow(val);
                                    }
                                    e.target.value = '';
                                }
                            }}
                        >
                            <option value="" disabled hidden>+ Añadir Fila...</option>
                            <option value="FFVV">Añadir en FFVV</option>
                            <option value="TIENDA">Añadir en Tienda</option>
                            <option value="LOGISTICA">Añadir en Varios (Salva)</option>
                        </select>
                    )}
                    <button onClick={exportExcel} disabled={loading || comisiones.length === 0} title="Exportar todo a Excel (mismos colores y formato)" style={{ ...actionControlStyle, background: '#107c41', opacity: (loading || comisiones.length === 0) ? 0.6 : 1 }}>
                        <ExcelIcon size={16} /> Exportar Excel
                    </button>
                    <button onClick={saveChanges} disabled={saving || !canModify} style={{ ...actionControlStyle, background: '#0ea5e9', opacity: (saving || !canModify) ? 0.6 : 1 }}>
                        <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            {loading && <p>Cargando datos...</p>}

            {!loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ background: '#5CB85C', padding: '6px 20px', borderRadius: 8, color: 'white', display: 'flex', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                        <input 
                            value={titulo} 
                            onChange={e => { if (canModify) setTitulo(e.target.value.toUpperCase()); }} 
                            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}
                            readOnly={!canModify}
                            placeholder="LIQUIDACIÓN DE VENTAS..."
                        />
                    </div>

                    {/* FFVV TABLE */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: '#0066cc', color: 'white' }}>
                                        <th style={{ padding: '2px 6px', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase' }}>FFVV</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>Importe</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>Varios</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>Descuentos</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>Dietas</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>KM</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>Incentivos</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>TOTAL</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comisiones.map((r, i) => {
                                        if (r.tipo !== 'FFVV') return null;
                                        return (
                                            <tr key={r.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f0f9ff', borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '2px 4px' }}><input style={inputStyle} value={r.nombre || ''} onChange={e => handleFieldChange(i, 'nombre', e.target.value)} /></td>
                                                <td style={{ padding: '2px 4px' }}><input style={numInputStyle} value={r.importe ?? ''} onChange={e => handleFieldChange(i, 'importe', e.target.value)} /></td>
                                                <td style={{ padding: '2px 4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input style={numInputStyle} value={r.aceleradores ?? ''} onChange={e => handleFieldChange(i, 'aceleradores', e.target.value)} />
                                                        {renderNoteIcon(i, 'notasVarios')}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '2px 4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input style={{...numInputStyle, color: r.descuentos ? '#ef4444' : '#0f172a', fontWeight: r.descuentos ? 600 : 400}} value={r.descuentos ?? ''} onChange={e => handleFieldChange(i, 'descuentos', e.target.value)} />
                                                        {renderNoteIcon(i, 'notasDescuentos')}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '2px 4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input style={numInputStyle} value={r.dietas ?? ''} onChange={e => handleFieldChange(i, 'dietas', e.target.value)} />
                                                        {renderNoteIcon(i, 'notasDietas')}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '2px 4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input style={numInputStyle} value={r.km ?? ''} onChange={e => handleFieldChange(i, 'km', e.target.value)} />
                                                        {renderNoteIcon(i, 'notasKm')}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 600, color: '#0066cc' }}>
                                                    {formatEuro(r.incentivos || 0)}
                                                </td>
                                                <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 800 }}>{formatEuro(r.total || 0)}</td>
                                                <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                                                    <button onClick={() => { if(window.confirm('¿Borrar fila?')) deleteRow(r.id); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr style={{ background: '#c1e1c1', fontWeight: 800 }}>
                                        <td style={{ padding: '2px 6px', textAlign: 'left' }}>TOTAL FFVV</td>
                                        <td colSpan={6}></td>
                                        <td style={{ padding: '2px 6px', textAlign: 'right', color: '#166534' }}>{formatEuro(totalFFVV)}</td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* TIENDAS TABLE */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: '#0066cc', color: 'white' }}>
                                        <th style={{ padding: '2px 6px', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase' }}>Tiendas</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>Importe</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>O2 y Varios</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>Descuentos</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>TOTAL</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comisiones.map((r, i) => {
                                        if (r.tipo !== 'TIENDA') return null;
                                        return (
                                            <tr key={r.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f0f9ff', borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '2px 4px' }}><input style={inputStyle} value={r.nombre || ''} onChange={e => handleFieldChange(i, 'nombre', e.target.value)} /></td>
                                                <td style={{ padding: '2px 4px' }}><input style={numInputStyle} value={r.importe ?? ''} onChange={e => handleFieldChange(i, 'importe', e.target.value)} /></td>
                                                <td style={{ padding: '2px 4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input style={numInputStyle} value={r.o2Varios ?? ''} onChange={e => handleFieldChange(i, 'o2Varios', e.target.value)} />
                                                        {renderNoteIcon(i, 'notasVarios')}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '2px 4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input style={{...numInputStyle, color: r.descuentos ? '#ef4444' : '#0f172a', fontWeight: r.descuentos ? 600 : 400}} value={r.descuentos ?? ''} onChange={e => handleFieldChange(i, 'descuentos', e.target.value)} />
                                                        {renderNoteIcon(i, 'notasDescuentos')}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 800 }}>{formatEuro(r.total || 0)}</td>
                                                <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                                                    <button onClick={() => { if(window.confirm('¿Borrar fila?')) deleteRow(r.id); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr style={{ background: '#c1e1c1', fontWeight: 800 }}>
                                        <td style={{ padding: '2px 6px', textAlign: 'left' }}>TOTAL TIENDAS</td>
                                        <td colSpan={3}></td>
                                        <td style={{ padding: '2px 6px', textAlign: 'right', color: '#166534' }}>{formatEuro(totalTiendas)}</td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* LOGISTICA TABLE */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: '#0066cc', color: 'white' }}>
                                        <th style={{ padding: '2px 6px', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase' }}>Logística</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>Comisiones</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>Gasolina</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>Dietas</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>KM</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>Incentivos</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>TOTAL</th>
                                        <th style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comisiones.map((r, i) => {
                                        if (r.tipo !== 'LOGISTICA') return null;
                                        return (
                                            <tr key={r.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f0f9ff', borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '2px 4px' }}><input style={inputStyle} value={r.nombre || ''} onChange={e => handleFieldChange(i, 'nombre', e.target.value)} /></td>
                                                <td style={{ padding: '2px 4px' }}><input style={numInputStyle} value={r.importe ?? ''} onChange={e => handleFieldChange(i, 'importe', e.target.value)} /></td>
                                                <td style={{ padding: '2px 4px' }}><input style={numInputStyle} value={r.gasolina ?? ''} onChange={e => handleFieldChange(i, 'gasolina', e.target.value)} /></td>
                                                <td style={{ padding: '2px 4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input style={numInputStyle} value={r.dietas ?? ''} onChange={e => handleFieldChange(i, 'dietas', e.target.value)} />
                                                        {renderNoteIcon(i, 'notasDietas')}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '2px 4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input style={numInputStyle} value={r.km ?? ''} onChange={e => handleFieldChange(i, 'km', e.target.value)} />
                                                        {renderNoteIcon(i, 'notasKm')}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 600, color: '#0066cc' }}>
                                                    {formatEuro(r.incentivos || 0)}
                                                </td>
                                                <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 800 }}>{formatEuro(r.total || 0)}</td>
                                                <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                                                    <button onClick={() => { if(window.confirm('¿Borrar fila?')) deleteRow(r.id); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr style={{ background: '#c1e1c1', fontWeight: 800 }}>
                                        <td style={{ padding: '2px 6px', textAlign: 'left' }}>TOTAL LOGÍSTICA</td>
                                        <td colSpan={5}></td>
                                        <td style={{ padding: '2px 6px', textAlign: 'right', color: '#166534' }}>{formatEuro(totalLogistica)}</td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '8px 20px', background: '#5CB85C', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 18 }}>Total General</h2>
                            <span style={{ fontSize: 13, opacity: 0.9 }}>TOTAL FFVV + TOTAL TIENDAS + TOTAL LOGÍSTICA</span>
                        </div>
                        <h2 style={{ margin: 0, fontSize: 24, color: '#ffffff', fontWeight: 800 }}>{formatEuro(totalFFVV + totalTiendas + totalLogistica)}</h2>
                    </div>
                </div>
            )}
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '2px 6px',
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    fontSize: 12,
    outline: 'none'
};

const numInputStyle: React.CSSProperties = {
    ...inputStyle,
    textAlign: 'right'
};

const formatEuro = (val: number) => val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
