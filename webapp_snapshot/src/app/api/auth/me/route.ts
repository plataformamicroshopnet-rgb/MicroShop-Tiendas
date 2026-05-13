export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const session = await getSession()
    if (!session || !session.user || !session.user.username) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    // Fetch fresh user data to ensure permissions are up to date immediately
    const dbUser = await prisma.user.findUnique({
      where: { username: session.user.username },
      select: { role: true, permissions: true, id: true, username: true }
    })

    if (dbUser) {
      // Merge fresh data with the session user
      session.user.role = dbUser.role
      session.user.permissions = dbUser.permissions
    }

    return NextResponse.json({ authenticated: true, user: session.user })
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
