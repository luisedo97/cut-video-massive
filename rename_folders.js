const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');

const mapping = {
    '20260131_110631': 'video_1',
    '20260131_111746': 'video_2',
    '20260131_112131': 'video_3',
    '20260131_113703': 'video_4',
    '20260131_113922': 'video_5',
    '20260131_114126': 'video_6',
    '20260131_114531': 'video_7',
    '20260131_115752': 'video_8',
    '20260131_122805': 'video_9',
    '20260131_123151': 'video_10',
    '20260131_123508': 'video_11',
    '20260131_124213': 'video_12',
    '20260131_124704': 'video_13',
    '20260131_130604': 'video_14',
    '20260131_131201': 'video_15',
    '20260131_131818': 'video_16'
};

if (!fs.existsSync(OUTPUT_DIR)) {
    console.error('❌ No existe la carpeta output');
    process.exit(1);
}

console.log('📂 Renombrando carpetas en output/ ...');

let renames = 0;

for (const [oldName, newName] of Object.entries(mapping)) {
    const oldPath = path.join(OUTPUT_DIR, oldName);
    const newPath = path.join(OUTPUT_DIR, newName);

    if (fs.existsSync(oldPath)) {
        try {
            if (fs.existsSync(newPath)) {
                console.warn(`⚠️  El destino ya existe: ${newName}. Se omite ${oldName}.`);
            } else {
                fs.renameSync(oldPath, newPath);
                console.log(`✅ ${oldName} -> ${newName}`);
                renames++;
            }
        } catch (err) {
            console.error(`❌ Error al renombrar ${oldName}:`, err.message);
        }
    } else {
        console.log(`ℹ️  No encontrado: ${oldName} (posiblemente ya renombrado o no se generó)`);
    }
}

console.log(`\n✨ Proceso finalizado. Total renombrados: ${renames}`);
