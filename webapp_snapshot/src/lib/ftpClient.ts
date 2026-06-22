import { Client } from 'basic-ftp'
import { Readable } from 'stream'

async function getConnectedClient() {
  const client = new Client()
  client.ftp.verbose = false
  
  const host = process.env.QNAP_FTP_HOST
  const user = process.env.QNAP_FTP_USER
  const password = process.env.QNAP_FTP_PASS
  const port = process.env.QNAP_FTP_PORT ? parseInt(process.env.QNAP_FTP_PORT, 10) : 21

  if (!host || !user || !password) {
    throw new Error('Faltan credenciales FTP (QNAP_FTP_HOST, QNAP_FTP_USER, QNAP_FTP_PASS)')
  }

  await client.access({
    host,
    user,
    password,
    port,
    secure: false // Cambiar a true si admitimos explícitamente FTPS
  })

  // Navegar a la carpeta destino si está definida
  const targetDir = process.env.QNAP_FTP_DIR || '/'
  await client.ensureDir(targetDir)
  
  return client
}

export async function uploadToFTP(fileName: string, buffer: Buffer): Promise<string> {
  const client = await getConnectedClient()
  try {
    const stream = new Readable()
    stream.push(buffer)
    stream.push(null)

    await client.uploadFrom(stream, fileName)
    return fileName
  } finally {
    client.close()
  }
}

export async function listFTPFiles() {
  const client = await getConnectedClient()
  try {
    const list = await client.list()
    // Filtrar solo los .zip de copias
    const zipFiles = list.filter(f => f.name.endsWith('.zip'))
    
    // Convertir al mismo formato que esperaba el frontend desde Google Drive
    return zipFiles.map(file => {
      let dateIso = new Date().toISOString();
      const match = file.name.match(/_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})\.zip$/);
      if (match) {
        const [, yyyy, mm, dd, hh, min] = match;
        const parsedDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), parseInt(hh), parseInt(min));
        if (!isNaN(parsedDate.getTime())) {
          dateIso = parsedDate.toISOString();
        }
      } else if (file.modifiedAt) {
        dateIso = new Date(file.modifiedAt).toISOString();
      }
      
      return {
        id: file.name,
        name: file.name,
        createdTime: dateIso,
        size: file.size,
        mimeType: 'application/zip',
        sizeMB: (file.size / (1024 * 1024)).toFixed(2)
      }
    }).sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
  } finally {
    client.close()
  }
}

export async function downloadFromFTP(fileName: string): Promise<Buffer> {
  const client = await getConnectedClient()
  try {
    const chunks: Buffer[] = []
    const writableStream = new (require('stream').Writable)({
        write(chunk: any, encoding: string, callback: Function) {
            chunks.push(Buffer.from(chunk))
            callback()
        }
    })
    
    await client.downloadTo(writableStream, fileName)
    return Buffer.concat(chunks)
  } finally {
    client.close()
  }
}

export async function cleanupOldBackups(retentionDays = 14, prefix = '') {
  const client = await getConnectedClient()
  try {
    const list = await client.list()
    // Solo .zip y, si se indica, solo los de ESTA app (evita borrar copias de otra app que comparta carpeta)
    const zipFiles = list.filter(f => f.name.endsWith('.zip') && (!prefix || f.name.startsWith(prefix)))
    
    const limitDate = new Date()
    limitDate.setDate(limitDate.getDate() - retentionDays)
    
    let deletedCount = 0
    for (const file of zipFiles) {
      if (file.modifiedAt && new Date(file.modifiedAt) < limitDate) {
        await client.remove(file.name)
        deletedCount++
        console.log(`[FTP Cleanup] Archivo eliminado: ${file.name}`)
      }
    }
    return deletedCount
  } finally {
    client.close()
  }
}
