// Archivo legado (refactorizado para evitar dependencia de local excel y fallos en producción)

export async function getExcelFilePath(): Promise<string> {
  return '';
}

export async function uploadExcelFileToDrive(localPath: string): Promise<void> {
  return;
}

export async function createDriveBackup(fileName: string): Promise<string> {
  return 'Backup_Deshabilitado_Por_Arquitectura_DB';
}

export async function listDriveBackups() {
  return [];
}

export async function downloadDriveBackupBuffer(backupId: string): Promise<Buffer> {
  return Buffer.from('');
}

export async function insertMultipleSalesRecords(recordsBySheet: Record<string, Record<string, any>[]>) {
  return;
}
