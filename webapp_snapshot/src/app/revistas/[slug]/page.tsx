import { PrismaClient } from '@prisma/client'
import { notFound } from 'next/navigation'
import MagazineViewerClient from './MagazineViewerClient'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export default async function ReadMagazinePage(
    props: { params: any }
) {
    // Next 15 App Router: resolve the Promise strictly
    const resolvedParams = await props.params
    const slug = resolvedParams?.slug

    console.log('MAGAZINE PAGE slug:', slug)

    if (!slug) return notFound()

    const magazine = await prisma.magazine.findUnique({
        where: { slug }
    })

    if (!magazine) return notFound()

    return <MagazineViewerClient magazine={magazine} />
}
// Cache invalidate
