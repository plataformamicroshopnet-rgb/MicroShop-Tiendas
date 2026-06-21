import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'

// Backup a la nube (Backblaze B2, S3-compatible). Reemplaza al FTP→QNAP, que no es
// accesible de forma fiable desde Railway. Variables de entorno (en Railway):
//   B2_KEY_ID, B2_APP_KEY, B2_BUCKET, B2_ENDPOINT, B2_REGION
// Las copias de esta app se guardan bajo el prefijo "tiendas/" dentro del bucket.

const PREFIX = 'tiendas/'

function getClient(): { client: S3Client; bucket: string } | null {
  const endpoint = process.env.B2_ENDPOINT
  const region = process.env.B2_REGION
  const keyId = process.env.B2_KEY_ID
  const appKey = process.env.B2_APP_KEY
  const bucket = process.env.B2_BUCKET
  if (!endpoint || !region || !keyId || !appKey || !bucket) return null
  const url = endpoint.startsWith('http') ? endpoint : `https://${endpoint}`
  const client = new S3Client({
    endpoint: url,
    region,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
    forcePathStyle: true,
  })
  return { client, bucket }
}

export function isB2Configured(): boolean {
  return getClient() !== null
}

export async function uploadToB2(filename: string, buffer: Buffer): Promise<string> {
  const c = getClient()
  if (!c) throw new Error('B2 no configurado (faltan variables B2_*)')
  const key = PREFIX + filename
  await c.client.send(new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: buffer }))
  return key
}

export async function cleanupOldB2(days: number): Promise<number> {
  const c = getClient()
  if (!c) return 0
  const cutoff = Date.now() - days * 86400000
  let deleted = 0
  let token: string | undefined = undefined
  do {
    const resp: any = await c.client.send(
      new ListObjectsV2Command({ Bucket: c.bucket, Prefix: PREFIX, ContinuationToken: token })
    )
    for (const obj of resp.Contents || []) {
      if (obj.LastModified && obj.LastModified.getTime() < cutoff && obj.Key) {
        await c.client.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: obj.Key }))
        deleted++
      }
    }
    token = resp.IsTruncated ? resp.NextContinuationToken : undefined
  } while (token)
  return deleted
}

export interface B2Backup {
  key: string
  date: Date
  sizeMb: number
}

export async function listB2Backups(): Promise<B2Backup[]> {
  const c = getClient()
  if (!c) return []
  const items: B2Backup[] = []
  let token: string | undefined = undefined
  do {
    const resp: any = await c.client.send(
      new ListObjectsV2Command({ Bucket: c.bucket, Prefix: PREFIX, ContinuationToken: token })
    )
    for (const obj of resp.Contents || []) {
      if (obj.Key && obj.Key.endsWith('.zip')) {
        items.push({
          key: obj.Key,
          date: obj.LastModified || new Date(0),
          sizeMb: Math.round(((obj.Size || 0) / 1048576) * 100) / 100,
        })
      }
    }
    token = resp.IsTruncated ? resp.NextContinuationToken : undefined
  } while (token)
  items.sort((a, b) => b.date.getTime() - a.date.getTime())
  return items
}

export async function downloadFromB2(key: string): Promise<Buffer> {
  const c = getClient()
  if (!c) throw new Error('B2 no configurado')
  const resp: any = await c.client.send(new GetObjectCommand({ Bucket: c.bucket, Key: key }))
  const bytes = await resp.Body.transformToByteArray()
  return Buffer.from(bytes)
}
