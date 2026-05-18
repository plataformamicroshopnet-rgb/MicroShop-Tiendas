'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Info, Target, Printer, Download, Save, X, Mail } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { useGuard } from '@/hooks/useGuard'
import { can } from '@/lib/permissions'
import ExcelJS from 'exceljs'

// Helper para Fechas
const getStartOfWeek = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Lunes
    d.setDate(diff)
    d.setHours(0,0,0,0)
    return d
}

const addDays = (date: Date, days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
}

const formatDate = (d: Date) => {
    return d.toISOString().split('T')[0]
}

const formatDisplayDate = (d: Date | undefined) => {
    if (!d) return ''
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function AgendaTiendasPage() {
    const { authorized, user } = useGuard('CARD_AGENDA_CRISTINA')
    
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getStartOfWeek(new Date()))
    const [comerciales, setComerciales] = useState<any[]>([])
    const [entries, setEntries] = useState<Record<string, any>>({}) // Key: "codigo_YYYY-MM-DD"
    const [loading, setLoading] = useState(true)
    const [showMailModal, setShowMailModal] = useState(false)
    const [selectedMailDays, setSelectedMailDays] = useState<string[]>([])

    const cristinaComerciales = comerciales.filter(c => !c.name.toLowerCase().includes('salva')).map(c => { if (c.name.toLowerCase().includes('cristina')) return { ...c, team: 'Jefa de Llamadas' }; return c; });

    // Modal State
    const [editingCell, setEditingCell] = useState<{ agendaKey: string, nombre: string, fecha: Date } | null>(null)
    const [editForm, setEditForm] = useState({ campanas: 0, clientesPropios: 0, dispositivos: 0, baf: 0, repos: 0, bdSalva: 0, competencia: 0, estado: 'ACTIVO', observaciones: '' })
    const [saving, setSaving] = useState(false)




    // Días de la semana actual (Lunes a Viernes)
    const weekDays = Array.from({ length: 5 }).map((_, i) => addDays(currentWeekStart, i))

    // Cargar datos
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                // 1. Cargar Comerciales
                const cRes = await fetch('/api/comerciales')
                const cData = await cRes.json()
                setComerciales(Array.isArray(cData?.comerciales) ? cData.comerciales : [])

                // 2. Cargar Entradas de la semana (Lunes a Viernes)
                const startStr = formatDate(currentWeekStart)
                const endStr = formatDate(addDays(currentWeekStart, 4))
                const eRes = await fetch(`/api/agenda-cristina?startDate=${startStr}&endDate=${endStr}`)
                const eData = await eRes.json()

                const map: Record<string, any> = {}
                if (Array.isArray(eData)) {
                    eData.forEach(entry => {
                        const dateOnly = new Date(entry.fecha).toISOString().split('T')[0]
                        map[`${entry.codigoComercial}_${dateOnly}`] = entry
                    })
                }
                setEntries(map)
            } catch (e) {
                console.error("Error cargando agenda", e)
            } finally {
                setLoading(false)
            }
        }
        
        // Wait for auth verification
        if (authorized !== null) fetchData()
    }, [currentWeekStart, authorized])

    const handlePreviousWeek = () => setCurrentWeekStart(prev => addDays(prev, -7))
    const handleNextWeek = () => setCurrentWeekStart(prev => addDays(prev, 7))
    const handleToday = () => setCurrentWeekStart(getStartOfWeek(new Date()))

    const openEdit = (comercial: any, date: Date) => {
        const dateStr = formatDate(date)
        const key = `${comercial.agendaKey}_${dateStr}`
        const exist = entries[key]

        setEditingCell({ agendaKey: comercial.agendaKey, nombre: comercial.name, fecha: date })
        setEditForm({
            campanas: exist?.campanas || 0, clientesPropios: exist?.clientesPropios || 0, dispositivos: exist?.dispositivos || 0, baf: exist?.baf || 0, repos: exist?.repos || 0, bdSalva: exist?.bdSalva || 0, competencia: exist?.competencia || 0,
            estado: exist?.estado || 'ACTIVO',
            observaciones: exist?.observaciones || ''
        })
    }

    const saveEdit = async () => {
        if (!editingCell) return
        setSaving(true)

        const dateStr = formatDate(editingCell.fecha)
        const payload = {
            agendaKey: editingCell.agendaKey,
            fecha: dateStr,
            ...editForm
        }

        try {
            const res = await fetch('/api/agenda-cristina', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            
            if (res.ok) {
                const data = await res.json()
                // Update local map
                const key = `${editingCell.agendaKey}_${dateStr}`
                setEntries(prev => ({ ...prev, [key]: data.entry }))
                setEditingCell(null)
            } else {
                alert("Error guardando el registro.")
            }
        } catch (e) {
            console.error(e)
            alert("Error de red.")
        } finally {
            setSaving(false)
        }
    }

    const renderAgendaTableHTML = (daysToRender: Date[] = weekDays) => {
        let html = `
            <div style="margin-bottom: 20px;">
                <h2 style="margin:0; font-size:22px; color: #111827;">Agenda de Llamadas Cristina</h2>
                <p style="margin:4px 0 0 0; color: #6b7280; font-size:14px;">Semana: ${formatDisplayDate(daysToRender[0])} — ${formatDisplayDate(daysToRender[daysToRender.length - 1])}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 13px;">
                <thead>
                    <tr>
                        <th style="padding: 12px; text-align: left; background: #f9fafb; border: 1px solid #d1d5db; width: 200px;">Comercial</th>
                        ${daysToRender.map(d => `<th style="padding: 12px; text-align: center; background: #f9fafb; border: 1px solid #d1d5db; width: 140px; text-transform: capitalize;">${d.toLocaleDateString('es-ES', { weekday: 'long' })}<br/><span style="font-size:16px;">${d.getDate()}</span></th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        cristinaComerciales.forEach(c => {
            let weekCampanas=0, weekClientes=0, weekDisp=0, weekBaf=0, weekRepos=0, weekBdSalva=0, weekComp=0;
            const rowCells: string[] = [];

            daysToRender.forEach(d => {
                const k = `${c.agendaKey}_${formatDate(d)}`;
                const ent = entries[k];
                if (ent) {
                    weekCampanas += ent.campanas || 0; weekClientes += ent.clientesPropios || 0; weekDisp += ent.dispositivos || 0; weekBaf += ent.baf || 0; weekRepos += ent.repos || 0; weekBdSalva += ent.bdSalva || 0; weekComp += ent.competencia || 0;

                    let cellHTML = '';
                    if (ent.estado === 'ACTIVO') {
                        const hasData = (ent.campanas > 0 || ent.clientesPropios > 0 || ent.dispositivos > 0 || ent.baf > 0 || ent.repos > 0 || ent.bdSalva > 0 || ent.competencia > 0);
                        if (hasData) {
                            cellHTML += `<div style="margin-bottom: 6px; font-weight: bold; font-size: 11px;">`;
                            if (ent.campanas > 0) cellHTML += `<span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px; display: inline-block; margin-bottom: 2px;">🎯 Campañas: ${ent.campanas}</span>`; if (ent.clientesPropios > 0) cellHTML += `<span style="background: rgba(14, 165, 233, 0.1); color: #0ea5e9; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px; display: inline-block; margin-bottom: 2px;">📞 Cl. Propios: ${ent.clientesPropios}</span>`; if (ent.dispositivos > 0) cellHTML += `<span style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px; display: inline-block; margin-bottom: 2px;">💻 Dispos: ${ent.dispositivos}</span>`; if (ent.baf > 0) cellHTML += `<span style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px; display: inline-block; margin-bottom: 2px;">📺 BAF: ${ent.baf}</span>`; if (ent.repos > 0) cellHTML += `<span style="background: rgba(236, 72, 153, 0.1); color: #ec4899; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px; display: inline-block; margin-bottom: 2px;">📦 Repos: ${ent.repos}</span>`; if (ent.bdSalva > 0) cellHTML += `<span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px; display: inline-block; margin-bottom: 2px;">🗃️ BD Salva: ${ent.bdSalva}</span>`; if (ent.competencia > 0) cellHTML += `<span style="background: rgba(63, 98, 18, 0.1); color: #3f6212; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; display: inline-block; margin-bottom: 2px;">⚔️ Compet.: ${ent.competencia}</span>`;
                            cellHTML += `</div>`;
                        }
                        if (ent.observaciones) {
                            cellHTML += `<div style="font-style: italic; color: #4b5563; font-size: 11px;">"${ent.observaciones}"</div>`;
                        }
                        if (!hasData && !ent.observaciones) cellHTML = '<span style="color:#d1d5db">—</span>';
                    } else {
                        const colors: any = { 'VACACIONES': '#d97706', 'BAJA': '#dc2626', 'LIBRE': '#4b5563', 'FORMACION': '#2563eb' };
                        cellHTML = `<span style="color: ${colors[ent.estado] || '#000'}; font-weight: bold; font-size: 11px;">${ent.estado}</span>`;
                    }
                    rowCells.push(`<td style="padding: 10px; text-align: center; border: 1px solid #d1d5db; vertical-align: top;">${cellHTML}</td>`);
                } else {
                    rowCells.push(`<td style="padding: 10px; border: 1px solid #d1d5db;"></td>`);
                }
            });

            html += `
                <tr>
                    <td style="padding: 12px; border: 1px solid #d1d5db; vertical-align: top;">
                        <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px; color: #111827;">${c.name}</div>
                        <div style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">${c.codigoComercial || ''} • ${c.team}</div>
                        <div style="font-size: 10px; font-weight: bold; padding: 4px 6px; background: #f3f4f6; border-radius: 4px; display: inline-block; color:#4b5563;">
                            🎯 Campañas: ${weekCampanas} &nbsp;|&nbsp; 📞 Cl. Propios: ${weekClientes} &nbsp;|&nbsp; 💻 Dispos: ${weekDisp} &nbsp;|&nbsp; 📺 BAF: ${weekBaf} &nbsp;|&nbsp; 📦 Repos: ${weekRepos} &nbsp;|&nbsp; 🗃️ BD Salva: ${weekBdSalva} &nbsp;|&nbsp; ⚔️ Compet.: ${weekComp}
                        </div>
                    </td>
                    ${rowCells.join('')}
                </tr>
            `;
        });

        html += `</tbody></table>`;
        return html;
    };

    const handlePrint = () => {
        if (!can(user, 'PRINT')) return alert('No tienes permisos para imprimir.')
        const html = renderAgendaTableHTML(weekDays)
        const w = window.open('', '_blank')
        if (w) {
            w.document.write(`
                <html><head><title>Agenda de Llamadas Cristina - Imprimir</title>
                <style>@page { size: landscape; margin: 1cm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>
                </head>
                <body style="font-family:sans-serif; margin:0; padding:0;">
                    ${html}
                    <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
                </body></html>
            `)
            w.document.close()
        }
    }

    const generateExcelBuffer = async () => {
        const workbook = new ExcelJS.Workbook()
        const sheet = workbook.addWorksheet('Agenda de Llamadas Cristina')

        const headers = ['Comercial', ...weekDays.map(d => d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase())]
        sheet.addRow(headers)

        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4b5563' } }
        sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
        sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
        
        sheet.getColumn(1).width = 35
        for (let i = 2; i <= 6; i++) sheet.getColumn(i).width = 30

        cristinaComerciales.forEach(c => {
            let weekCampanas=0, weekClientes=0, weekDisp=0, weekBaf=0, weekRepos=0, weekBdSalva=0, weekComp=0;
            const dayCells: string[] = []

            weekDays.forEach(d => {
                const k = `${c.agendaKey}_${formatDate(d)}`
                const ent = entries[k]
                if (ent) {
                    weekCampanas += ent.campanas || 0
                    weekClientes += ent.clientesPropios || 0
                    weekDisp += ent.dispositivos || 0
                    weekBaf += ent.baf || 0; weekRepos += ent.repos || 0; weekBdSalva += ent.bdSalva || 0; weekComp += ent.competencia || 0

                    let cellText = ''
                    if (ent.estado === 'ACTIVO') {
                        const hasData = (ent.campanas > 0 || ent.clientesPropios > 0 || ent.dispositivos > 0 || ent.baf > 0 || ent.repos > 0 || ent.bdSalva > 0 || ent.competencia > 0)
                        if (hasData) cellText += `C: ${ent.campanas || 0} | CP: ${ent.clientesPropios || 0} | D: ${ent.dispositivos || 0} | B: ${ent.baf || 0} | R: ${ent.repos || 0} | BD: ${ent.bdSalva || 0} | CO: ${ent.competencia || 0}\n`
                        if (ent.observaciones) cellText += `"${ent.observaciones}"`
                        if (!hasData && !ent.observaciones) cellText = '—'
                    } else {
                        cellText = ent.estado
                    }
                    dayCells.push(cellText.trim())
                } else {
                    dayCells.push('')
                }
            })

            const comercialHeader = `${c.name}\n${c.codigoComercial || ''} • ${c.team}\nTotal Acumulado: C: ${weekCampanas} | CP: ${weekClientes} | D: ${weekDisp} | B: ${weekBaf} | R: ${weekRepos} | BD: ${weekBdSalva} | CO: ${weekComp}`
            
            const r = sheet.addRow([comercialHeader, ...dayCells])
            r.height = 70
            r.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
        })

        return await workbook.xlsx.writeBuffer()
    }

    const handleExcel = async () => {
        if (!can(user, 'EXPORT_EXCEL')) return alert('No tienes permisos para exportar a Excel.')
        try {
            const buf = await generateExcelBuffer()
            const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob)
            
            const a = document.createElement('a')
            a.href = url
            a.download = `Agenda_Tiendas_${formatDate(weekDays[0])}.xlsx`
            a.click()
            window.URL.revokeObjectURL(url)
        } catch (e) {
            console.error(e)
            alert("Error al generar Excel.")
        }
    }

    const handleMail = () => {
        if (!can(user, 'SEND_EMAIL')) return alert('No tienes permisos para usar esta función.')
        setSelectedMailDays(weekDays.map(d => formatDate(d)))
        setShowMailModal(true)
    }

    const confirmMail = async () => {
        const daysToRender = weekDays.filter(d => selectedMailDays.includes(formatDate(d)));
        if (daysToRender.length === 0) return alert('Selecciona al menos un día.');
        
        // Se envuelve en HTML y se añade meta charset utf-8 para prevenir caracteres raros en Outlook
        const html = `<html><head><meta charset="utf-8"></head><body>${renderAgendaTableHTML(daysToRender)}</body></html>`;
        
        try {
            const blobHtml = new Blob([html], { type: 'text/html' });
            const blobText = new Blob(['Agenda copiada'], { type: 'text/plain' });
            const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
            await navigator.clipboard.write(data);
            alert('¡Copiado al portapapeles correctamente! Ya puedes pegarlo en tu cliente de correo.');
            setShowMailModal(false);
        } catch (err) {
            console.error('Error copying via ClipboardItem:', err);
            try {
                // Fallback for Safari/Firefox
                const div = document.createElement("div");
                div.innerHTML = html;
                div.style.position = "fixed";
                div.style.left = "-9999px";
                document.body.appendChild(div);
                
                const range = document.createRange();
                range.selectNodeContents(div);
                const selection = window.getSelection();
                selection?.removeAllRanges();
                selection?.addRange(range);
                
                const successful = document.execCommand('copy');
                selection?.removeAllRanges();
                document.body.removeChild(div);
                
                if (successful) {
                    alert('¡Copiado al portapapeles correctamente! Ya puedes pegarlo en tu correo.');
                } else {
                    alert('Fallo al copiar automáticamente. Por favor comprueba los permisos de tu navegador.');
                }
                setShowMailModal(false);
            } catch (e) {
                alert('El navegador bloqueó la copia silenciosa. Por favor usa CTRL+C seleccionando la tabla.');
            }
        }
    } 

    const renderCellContent = (estado: string, ent: any, obj?: string) => {
        if (estado === 'VACACIONES') return <span style={{ color: '#d97706', fontWeight: 600, fontSize: 11 }}>🏖️ Vacaciones</span>
        if (estado === 'BAJA') return <span style={{ color: '#dc2626', fontWeight: 600, fontSize: 11 }}>🏥 Baja Médica</span>
        if (estado === 'LIBRE') return <span style={{ color: '#4b5563', fontWeight: 600, fontSize: 11 }}>☕ Día Libre</span>
        if (estado === 'FORMACION') return <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 11 }}>📚 Formación</span>
        
        // Estado ACTIVO (Mostrar métricas)
        const hasData = (ent.campanas > 0 || ent.clientesPropios > 0 || ent.dispositivos > 0 || ent.baf > 0 || ent.repos > 0 || ent.bdSalva > 0 || ent.competencia > 0);
        if (!hasData && !obj) return <span style={{ color: 'var(--border-strong)', fontSize: 11 }}>—</span>
        
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', padding: '4px' }}>
                {hasData && (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        {ent.campanas > 0 && <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>🎯 {ent.campanas}</span>}
                        {ent.clientesPropios > 0 && <span style={{ background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>📞 {ent.clientesPropios}</span>}
                        {ent.dispositivos > 0 && <span style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>💻 {ent.dispositivos}</span>}
                        {ent.baf > 0 && <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>📺 {ent.baf}</span>}
                        {ent.repos > 0 && <span style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>📦 {ent.repos}</span>}
                        {ent.bdSalva > 0 && <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>🗃️ {ent.bdSalva}</span>}
                        {ent.competencia > 0 && <span style={{ background: 'rgba(63, 98, 18, 0.1)', color: '#3f6212', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>⚔️ {ent.competencia}</span>}
                    </div>
                )}
                {obj && <div style={{ fontSize: 10, color: '#4b5563', fontStyle: 'italic', wordBreak: 'break-word', whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', padding: '0 4px', lineHeight: 1.2 }}>"{obj}"</div>}
            </div>
        )
    }

    if (authorized === null) return <div style={{ padding: 40, color: '#0ea5e9', fontWeight: 600 }}>Verificando credenciales...</div>

    return (
        <div style={{ padding: 20 }}>
            
            <PageHeader 
                title={<><Calendar className="text-cyan" size={28} /> Agenda de Llamadas Cristina</>}
                subtitle="Tracking diario visual de la Fuerza de Ventas y asistencia."
                showBack={true}
                backFallback="/seguimiento-ventas"
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24, marginTop: -8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={handleMail} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--light-text)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        <Mail size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Mail
                    </button>
                    <button onClick={handlePrint} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--light-text)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        <Printer size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Imprimir
                    </button>
                    <button onClick={handleExcel} style={{ background: '#0ea5e9', border: 'none', color: 'var(--bg-card)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        <Download size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Excel .xlsx
                    </button>
                </div>
            </div>

            {/* Selector de Semanas */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button onClick={handlePreviousWeek} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <ChevronLeft size={20} color="#4b5563" />
                    </button>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', minWidth: 260, textAlign: 'center' }}>
                        Semana: {formatDisplayDate(weekDays[0])} — {formatDisplayDate(weekDays[weekDays.length - 1])}
                    </div>
                    <button onClick={handleNextWeek} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <ChevronRight size={20} color="#4b5563" />
                    </button>
                </div>
                <button onClick={handleToday} style={{ background: 'var(--active-bg)', border: 'none', color: 'var(--text-main)', padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Ir a Hoy
                </button>
            </div>

            {/* Grid Principal */}
            <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ overflowX: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
                        <thead style={{ background: 'var(--active-bg)', position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr>
                                <th style={{ padding: '16px 20px', textAlign: 'left', borderBottom: '1px solid var(--border-strong)', borderRight: '1px solid var(--border-strong)', width: 220, color: '#4b5563', fontSize: 13, fontWeight: 700 }}>Comercial</th>
                                {weekDays.map((d, i) => {
                                    const isToday = formatDate(d) === formatDate(new Date());
                                    return (
                                        <th key={i} style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border-strong)', borderRight: '1px solid var(--border-strong)', width: 130, color: isToday ? '#0ea5e9' : '#4b5563', fontSize: 12, fontWeight: isToday ? 800 : 700, background: isToday ? 'rgba(14, 165, 233, 0.05)' : 'transparent' }}>
                                            <div style={{ textTransform: 'capitalize' }}>{d.toLocaleDateString('es-ES', { weekday: 'long' })}</div>
                                            <div style={{ fontSize: 14, marginTop: 4 }}>{d.getDate()}</div>
                                        </th>
                                    )
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando cuadrícula...</td></tr>
                            ) : !Array.isArray(cristinaComerciales) || cristinaComerciales.length === 0 ? (
                                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No existen comerciales activos.</td></tr>
                            ) : (
                                cristinaComerciales.map((c, i) => {
                                    // Calculate weekly sums
                                    let weekCampanas=0, weekClientes=0, weekDisp=0, weekBaf=0, weekRepos=0, weekBdSalva=0, weekComp=0;
                                    weekDays.forEach(d => {
                                        const k = `${c.agendaKey}_${formatDate(d)}`;
                                        if (entries[k]) {
                                            weekCampanas += entries[k].campanas || 0; weekClientes += entries[k].clientesPropios || 0; weekDisp += entries[k].dispositivos || 0; weekBaf += entries[k].baf || 0; weekRepos += entries[k].repos || 0; weekBdSalva += entries[k].bdSalva || 0; weekComp += entries[k].competencia || 0;
                                        }
                                    });

                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--active-bg)' }}>
                                            <td style={{ padding: '12px 20px', borderRight: '1px solid var(--border-strong)', background: 'var(--bg-card)' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 13 }}>{c.name}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.codigoComercial} • {c.team}</div>
                                                <div style={{ marginTop: 8, display: 'inline-flex', gap: 8, fontSize: 10, fontWeight: 700, color: '#4b5563', background: 'var(--active-bg)', padding: '2px 8px', borderRadius: 4 }}>
                                                    <span title="Campañas">🎯 {weekCampanas}</span><span title="Cl. Propios">📞 {weekClientes}</span><span title="Disp">💻 {weekDisp}</span><span title="BAF">📺 {weekBaf}</span><span title="Repos">📦 {weekRepos}</span><span title="BD">🗃️ {weekBdSalva}</span><span title="Comp">⚔️ {weekComp}</span>
                                                </div>
                                            </td>
                                            {weekDays.map((d, j) => {
                                                const dateStr = formatDate(d);
                                                const k = `${c.agendaKey}_${dateStr}`;
                                                const ent = entries[k];
                                                const isToday = dateStr === formatDate(new Date());

                                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                                const bgColor = isToday ? 'rgba(14, 165, 233, 0.02)' : (isWeekend ? '#fafafa' : 'var(--bg-card)');
                                                const isEditing = editingCell && editingCell.agendaKey === c.agendaKey && formatDate(editingCell.fecha) === dateStr;

                                                return (
                                                    <td 
                                                        key={j} 
                                                        onClick={() => !isEditing && openEdit(c, d)}
                                                        style={{ 
                                                            padding: 0, 
                                                            textAlign: 'center', 
                                                            borderRight: '1px solid var(--border-strong)', 
                                                            background: isEditing ? 'rgba(245, 158, 11, 0.05)' : bgColor,
                                                            cursor: 'pointer',
                                                            position: 'relative',
                                                            height: 70,
                                                            verticalAlign: 'middle',
                                                            transition: 'background 0.2s'
                                                        }}
                                                        onMouseOver={e => !isEditing && (e.currentTarget.style.background = 'var(--active-bg)')}
                                                        onMouseOut={e => !isEditing && (e.currentTarget.style.background = bgColor)}
                                                    >
                                                        {ent ? renderCellContent(ent.estado, ent, ent.observaciones) : (
                                                            <div style={{ color: 'var(--border-strong)', fontSize: 11, opacity: isWeekend ? 0.3 : 1 }}>+</div>
                                                        )}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Edit Popover (Centrado Globalmente) */}
            {editingCell && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ width: 380, background: 'var(--bg-card)', borderRadius: 12, padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ padding: '16px 20px', background: '#0ea5e9', color: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{editingCell.nombre}</h3>
                                <div style={{ fontSize: 14, opacity: 0.9, marginTop: 2 }}>{formatDisplayDate(editingCell.fecha)}</div>
                            </div>
                            <button onClick={() => setEditingCell(null)} style={{ background: 'transparent', border: 'none', color: 'var(--bg-card)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        
                        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#4b5563', marginBottom: 6 }}>Estado</label>
                                <select 
                                    value={editForm.estado} 
                                    onChange={e => setEditForm({...editForm, estado: e.target.value})}
                                    style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 13, fontWeight: 600, outline: 'none' }}
                                >
                                    <option value="ACTIVO">Activo (Trabajando)</option>
                                    <option value="VACACIONES">Vacaciones</option>
                                    <option value="BAJA">Baja Médica</option>
                                    <option value="LIBRE">Día Libre</option>
                                    <option value="FORMACION">Formación</option>
                                </select>
                            </div>

                            {editForm.estado === 'ACTIVO' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 6 }}>🎯 Campañas</label>
                                        <input type="number" min="0" value={editForm.campanas === 0 ? '' : editForm.campanas} placeholder="0" onChange={e => setEditForm({...editForm, campanas: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#0ea5e9', marginBottom: 6 }}>📞 Cl. Propios</label>
                                        <input type="number" min="0" value={editForm.clientesPropios === 0 ? '' : editForm.clientesPropios} placeholder="0" onChange={e => setEditForm({...editForm, clientesPropios: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 6 }}>💻 Dispos</label>
                                        <input type="number" min="0" value={editForm.dispositivos === 0 ? '' : editForm.dispositivos} placeholder="0" onChange={e => setEditForm({...editForm, dispositivos: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>📺 BAF</label>
                                        <input type="number" min="0" value={editForm.baf === 0 ? '' : editForm.baf} placeholder="0" onChange={e => setEditForm({...editForm, baf: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#ec4899', marginBottom: 6 }}>📦 Repos</label>
                                        <input type="number" min="0" value={editForm.repos === 0 ? '' : editForm.repos} placeholder="0" onChange={e => setEditForm({...editForm, repos: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>🗃️ BD Salva</label>
                                        <input type="number" min="0" value={editForm.bdSalva === 0 ? '' : editForm.bdSalva} placeholder="0" onChange={e => setEditForm({...editForm, bdSalva: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#3f6212', marginBottom: 6 }}>⚔️ Compet.</label>
                                        <input type="number" min="0" value={editForm.competencia === 0 ? '' : editForm.competencia} placeholder="0" onChange={e => setEditForm({...editForm, competencia: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#4b5563', marginBottom: 6 }}>Observaciones Cortas</label>
                                <textarea maxLength={150} value={editForm.observaciones} onChange={e => setEditForm({...editForm, observaciones: e.target.value})} placeholder="Ej. Bajo en Dispos..." style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none', resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }} />
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>Max 150 chars</div>
                            </div>
                        </div>

                        <div style={{ padding: '12px 20px', background: 'var(--active-bg)', borderTop: '1px solid var(--border-strong)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button onClick={() => setEditingCell(null)} disabled={saving} style={{ background: 'transparent', border: 'none', color: '#4b5563', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                            <button onClick={saveEdit} disabled={saving} style={{ background: '#0ea5e9', border: 'none', color: 'var(--bg-card)', fontWeight: 600, fontSize: 13, padding: '8px 16px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {saving ? 'Guardando...' : <><Save size={16} /> Aplicar Cambios</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        
            {showMailModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ width: 320, background: 'var(--bg-card)', borderRadius: 12, padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ padding: '16px 20px', background: '#0ea5e9', color: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>Configurar Envío Mail</h3>
                            <button onClick={() => setShowMailModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--bg-card)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ padding: 20 }}>
                            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--text-muted)' }}>Selecciona qué días quieres incluir en la tabla del correo:</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {weekDays.map(d => {
                                    const dateStr = formatDate(d);
                                    const isSelected = selectedMailDays.includes(dateStr);
                                    return (
                                        <label key={dateStr} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', background: isSelected ? 'var(--active-bg)' : 'transparent', border: '1px solid', borderColor: isSelected ? '#0ea5e9' : 'var(--border-strong)', borderRadius: 6, transition: 'all 0.2s' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedMailDays(prev => [...prev, dateStr].sort());
                                                    else setSelectedMailDays(prev => prev.filter(x => x !== dateStr));
                                                }}
                                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                                            />
                                            <span style={{ fontSize: 14, fontWeight: isSelected ? 700 : 500, color: 'var(--text-main)', textTransform: 'capitalize' }}>
                                                {d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                                            </span>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>
                        <div style={{ padding: '12px 20px', background: 'var(--active-bg)', borderTop: '1px solid var(--border-strong)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button onClick={() => setShowMailModal(false)} style={{ background: 'transparent', border: 'none', color: '#4b5563', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={confirmMail} style={{ background: '#0ea5e9', border: 'none', color: 'var(--bg-card)', fontWeight: 600, fontSize: 13, padding: '8px 16px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Mail size={16} /> Generar y Copiar
                            </button>
                        </div>
                    </div>
                </div>
            )}
    </div>
    )
}
