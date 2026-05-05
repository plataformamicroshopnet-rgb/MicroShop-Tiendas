import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listFTPFiles } from '@/lib/ftpClient'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const files = await listFTPFiles()

    return NextResponse.json({ success: true, files })
  } catch (err: any) {
    console.error('Error in ftp-list:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
