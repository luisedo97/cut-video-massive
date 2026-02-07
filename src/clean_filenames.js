const fs = require('fs');
const path = require('path');

const DIRECTORY = path.join(__dirname, 'source/videos');

if (!fs.existsSync(DIRECTORY)) {
    console.error(`❌ El directorio "${DIRECTORY}" no existe.`);
    process.exit(1);
}

console.log(`📂 Escaneando directorio: ${DIRECTORY}`);

fs.readdir(DIRECTORY, (err, files) => {
    if (err) {
        console.error('❌ Error al leer el directorio:', err);
        return;
    }

    let processedCount = 0;

    files.forEach(file => {
        // Solo procesar archivos .mp4
        if (path.extname(file).toLowerCase() === '.mp4') {
            const originalName = file;
            const nameWithoutExt = path.basename(file, '.mp4');

            // Verificar si tiene un guion "-"
            if (nameWithoutExt.includes('-')) {
                // Tomar todo lo que está ANTES del primer guion
                // El usuario dijo "elimines lo que sea que venga despues de un '-'".
                // Asumimos el PRIMER guion ya que el ejemplo "date_code-anything" sugiere separar ahí.
                const parts = nameWithoutExt.split('-');
                const newNameBase = parts[0];
                const newName = newNameBase + '.mp4';

                const oldPath = path.join(DIRECTORY, originalName);
                const newPath = path.join(DIRECTORY, newName);

                // Evitar sobrescribir si ya existe un archivo con ese nombre
                if (fs.existsSync(newPath) && newName !== originalName) {
                    console.warn(`⚠️  No se puede renombrar "${originalName}" a "${newName}" porque el destino ya existe.`);
                } else if (newName !== originalName) {
                    fs.rename(oldPath, newPath, (err) => {
                        if (err) {
                            console.error(`❌ Error al renombrar "${originalName}":`, err);
                        } else {
                            console.log(`✅ Renombrado: "${originalName}" -> "${newName}"`);
                        }
                    });
                    processedCount++;
                }
            }
        }
    });

    if (processedCount === 0) {
        console.log('ℹ️  No se encontraron archivos para renombrar (o no tenían guiones).');
    }
});
