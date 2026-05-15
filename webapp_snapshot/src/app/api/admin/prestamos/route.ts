import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    try {
        if (year) {
            const data = await prisma.patrimonioRecord.findUnique({
                where: { year: Number(year) }
            });
            return NextResponse.json(data || { year: Number(year) });
        } else {
            // Get all records ordered by year
            const data = await prisma.patrimonioRecord.findMany({
                orderBy: { year: 'asc' }
            });
            return NextResponse.json(data);
        }
    } catch (error) {
        console.error("Error fetching prestamos:", error);
        return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { year, field, value } = body;

        if (!year || !field) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Upsert the value
        const updated = await prisma.patrimonioRecord.upsert({
            where: { year: Number(year) },
            update: { [field]: value },
            create: {
                year: Number(year),
                [field]: value
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating prestamo:", error);
        return NextResponse.json({ error: 'Error updating data' }, { status: 500 });
    }
}
