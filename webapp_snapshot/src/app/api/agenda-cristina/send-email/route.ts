import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getSession } from '@/lib/auth'

export async function POST(request: Request) {
    const session = await getSession()
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { to, subject, htmlBody, excelBase64, message } = body

        if (!to || !htmlBody || !excelBase64) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const customMessageHTML = message 
            ? `<div style="background:#f3f4f6; padding:16px; margin-bottom:24px; border-left:4px solid #10b981; font-family:sans-serif;">${message.replace(/\n/g, '<br/>')}</div>` 
            : ''

        const finalHTML = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                </head>
                <body style="font-family: Arial, sans-serif; color: #111827;">
                    ${customMessageHTML}
                    ${htmlBody}
                </body>
            </html>
        `

        // Validación Dura de Credenciales
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.error("[SMTP Error] Faltan las credenciales SMTP_USER o SMTP_PASS en el archivo .env")
            return NextResponse.json({ error: 'Configuración SMTP incompleta en el servidor.' }, { status: 500 })
        }

        console.log(`\n[SMTP] Iniciando envío de correo...`)
        console.log(`[SMTP] Servidor: ${process.env.SMTP_HOST || 'smtp.office365.com'}:${process.env.SMTP_PORT || 587}`)
        console.log(`[SMTP] Remitente (from): "MicroShop Portal" <${process.env.SMTP_USER}>`)
        console.log(`[SMTP] Destinatario (to): ${to}`)
        console.log(`[SMTP] Asunto (subject): ${subject || 'Agenda Comercial'}`)

        // Endpoint TLS protegido hacia servidor final
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.office365.com',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false, // TLS Start (false para puerto 587)
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        })

        // La promesa real despachada a Office365/Gmail
        const info = await transporter.sendMail({
            from: `"MicroShop Portal" <${process.env.SMTP_USER}>`,
            to: to,
            subject: subject || 'Agenda Comercial',
            html: finalHTML,
            attachments: [
                {
                    filename: 'Agenda_Comercial.xlsx',
                    content: Buffer.from(excelBase64, 'base64')
                }
            ]
        })

        console.log(`[SMTP] ✅ Envío confirmado por el proveedor. MessageId: ${info.messageId}\n`)
        return NextResponse.json({ success: true, messageId: info.messageId })
    } catch (error: any) {
        console.error('\n[SMTP] ❌ Error real capturado al enviar email SMTP:', error.message || error)
        return NextResponse.json({ error: 'El proveedor SMTP rechazó el correo o falló la conexión.' }, { status: 500 })
    }
}
