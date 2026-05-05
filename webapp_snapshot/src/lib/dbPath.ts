import path from 'path';

export function getDbPaths() {
    let dbDir = path.join(process.cwd(), 'prisma');
    let dbPath = path.join(dbDir, 'database.sqlite');
    
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
        let envPath = process.env.DATABASE_URL.replace('file:', '');
        if (!path.isAbsolute(envPath)) {
            dbPath = path.join(process.cwd(), 'prisma', envPath);
        } else {
            dbPath = envPath;
        }
        dbDir = path.dirname(dbPath);
    }
    
    return {
        dbDir,
        dbPath,
        walPath: dbPath + '-wal',
        shmPath: dbPath + '-shm',
        tempPath: path.join(dbDir, 'temp_restore.sqlite'),
        tempWalPath: path.join(dbDir, 'temp_restore.sqlite-wal'),
        tempShmPath: path.join(dbDir, 'temp_restore.sqlite-shm'),
        backupPath: path.join(dbDir, 'database_backup_old.sqlite')
    }
}
