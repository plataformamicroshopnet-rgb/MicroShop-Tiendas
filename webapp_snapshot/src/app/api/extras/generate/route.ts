import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { runExtrasEngine } from '@/lib/extrasEngine'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
        return NextResponse.json({ success: false, error: 'Unauthorized. Debe iniciar sesión.' }, { status: 401 })
    }

    const { targetPeriodId } = await request.json().catch(() => ({ targetPeriodId: undefined }));

    const result = await runExtrasEngine(targetPeriodId);

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[POST Extras Generate]', error)
    return NextResponse.json({ success: false, error: String(error) + '\n\n' + error.stack }, { status: 500 })
  }
}
