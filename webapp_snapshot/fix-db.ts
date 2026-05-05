import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
  await prisma.magazine.update({
    where: { id: "cmn3i3idm00deq592hyepcsof" },
    data: {
      pdfUrl: "/revistas_uploads/1774430603228_Revista_Marzo_2026.pdf",
      coverUrl: "/revistas_uploads/1774430618797_Portada_Marzo_2026.png"
    }
  });
  
  await prisma.magazine.update({
    where: { id: "cmn3ia7b200dfq592oigwsrvh" },
    data: {
      pdfUrl: "/revistas_uploads/1774430565785_Revista_Enero_2026.pdf",
      coverUrl: "/revistas_uploads/1774430587275_Portada_Enero_2026.png"
    }
  });

  await prisma.magazine.update({
    where: { id: "cmn3iayyd00dgq592zkljai2n" },
    data: {
      pdfUrl: "/revistas_uploads/1774430527280_Revista_Noviembre_2025.pdf",
      coverUrl: "/revistas_uploads/1774430548196_Portada_Noviembre_2025.png"
    }
  });

  console.log("DB Fixed");
}

fix()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
