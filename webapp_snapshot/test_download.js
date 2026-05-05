const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

async function testDownload() {
  try {
    const dbDir = path.join(process.cwd(), 'prisma')
    const dbPath = path.join(dbDir, 'database.sqlite')
    const walPath = path.join(dbDir, 'database.sqlite-wal')
    const shmPath = path.join(dbDir, 'database.sqlite-shm')

    if (!fs.existsSync(walPath)) await fs.promises.writeFile(walPath, '');
    if (!fs.existsSync(shmPath)) await fs.promises.writeFile(shmPath, '');

    const zip = new AdmZip()
    zip.addLocalFile(dbPath)
    zip.addLocalFile(walPath)
    zip.addLocalFile(shmPath)

    const zipBuffer = zip.toBuffer()
    console.log("SUCCESS, buffer size:", zipBuffer.length);
  } catch (error) {
    console.error("ERROR in testDownload:", error);
  }
}
testDownload();
