"use client"

import dynamic from "next/dynamic"

const MagazineViewer = dynamic(() => import("./MagazineViewer"), {
    ssr: false,
})

export default function MagazineViewerClient({ magazine }: { magazine: any }) {
    return <MagazineViewer magazine={magazine} />
}