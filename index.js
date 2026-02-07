const ffmpeg = require('fluent-ffmpeg');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const slugify = require('slugify');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// --- CONFIGURACIÓN VIA ARGUMENTOS ---
const argv = yargs(hideBin(process.argv))
    .option('video', {
        alias: 'v',
        type: 'string',
        default: 'source/videos/video_0.mp4',
        description: 'Ruta del archivo de video (para modo individual)'
    })
    .option('excel', {
        alias: 'e',
        type: 'string',
        default: 'source/sheets/video_0.xlsx',
        description: 'Ruta del archivo Excel (para modo individual)'
    })
    .option('output', {
        alias: 'o',
        type: 'string',
        default: './output',
        description: 'Carpeta de salida'
    })
    .option('all', {
        alias: 'a',
        type: 'boolean',
        default: false,
        description: 'Procesar todos los xlsx en source/sheets buscando su video correspondiente en source/videos'
    })
    .argv;

const OUTPUT_DIR = argv.output;

// Mapeo de columnas
const COL_START = 'inicio';
const COL_END = 'fin';
const COL_NAME = 'nombre';

// --- LÓGICA CORE REUTILIZABLE ---
const processPair = async (videoPath, excelPath, outputBaseDir) => {
    console.log(`\n🚀 Iniciando par:`);
    console.log(`   📄 Excel: ${excelPath}`);
    console.log(`   📹 Video: ${videoPath}`);

    if (!fs.existsSync(videoPath)) {
        console.error(`❌ El video no existe: ${videoPath}`);
        return;
    }
    if (!fs.existsSync(excelPath)) {
        console.error(`❌ El excel no existe: ${excelPath}`);
        return;
    }

    // Definir carpeta de salida específica basada en el nombre del video
    const videoName = path.parse(videoPath).name;
    const FINAL_OUTPUT_DIR = path.join(outputBaseDir, videoName);

    if (!fs.existsSync(FINAL_OUTPUT_DIR)) {
        fs.mkdirSync(FINAL_OUTPUT_DIR, { recursive: true });
    }

    console.log(`📂 Carpeta de salida: ${FINAL_OUTPUT_DIR}`);
    console.log('📊 Leyendo Excel...');

    // Leer el archivo y convertir la primera hoja a JSON
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });

    console.log(`📂 Se encontraron ${data.length} cortes para procesar.`);

    // Procesamiento SECUENCIAL (uno por uno)
    for (const [index, row] of data.entries()) {
        const start = row[COL_START];
        const end = row[COL_END];
        const rawName = row[COL_NAME];

        if (!end) {
            console.warn(`⚠️  Fila ${index + 2}: Falta tiempo fin (se usará hasta el final del video).`);
        }

        // Parsear tiempos
        const startTime = parseTime(start) || 0;
        const endTime = parseTime(end);

        // Usar slugify para limpiar el nombre
        const cleanName = slugify(rawName || `sin_nombre_${Date.now()}`, {
            replacement: '_',
            remove: /[*+~.()'"!:@]/g,
            lower: true,
            strict: true
        });

        const fileName = cleanName + '.mp4';
        const outputPath = path.join(FINAL_OUTPUT_DIR, fileName);

        console.log(`[${index + 1}/${data.length}] ✂️  Procesando: "${fileName}"`);
        console.log(`   ⏱️  Tiempo: ${formatSeconds(startTime)} -> ${endTime ? formatSeconds(endTime) : 'FIN'}`);

        // Input Seeking
        const inputOptions = [`-ss ${startTime}`];
        const outputOptions = ['-c copy', '-map 0'];

        if (endTime) {
            const duration = endTime - startTime;
            if (duration > 0) {
                outputOptions.push(`-t ${duration}`);
            } else {
                console.warn(`⚠️  Duración inválida (${duration}s) para ${fileName}. Se omitirá el corte final.`);
            }
        }

        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .inputOptions(inputOptions)
                .outputOptions(outputOptions)
                .output(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => {
                    console.error(`❌ Error en ${fileName}:`, err.message);
                    resolve(); // Resolvemos para continuar con el siguiente
                })
                .run();
        });
    }
    console.log(`✅ Finalizado video: ${videoName}`);
};

// --- FUNCIÓN PRINCIPAL ---
const main = async () => {
    if (argv.all) {
        // MODO BATCH
        const SHEETS_DIR = 'source/sheets';
        const VIDEOS_DIR = 'source/videos';

        console.log('🔄 Modo Batch activado.');
        console.log(`📂 Buscando sheets en: ${SHEETS_DIR}`);

        if (!fs.existsSync(SHEETS_DIR)) {
            console.error('❌ No existe la carpeta source/sheets');
            return;
        }

        const files = fs.readdirSync(SHEETS_DIR);
        const excelFiles = files.filter(f => f.toLowerCase().endsWith('.xlsx'));

        if (excelFiles.length === 0) {
            console.log('ℹ️  No se encontraron archivos .xlsx en source/sheets');
            return;
        }

        console.log(`found ${excelFiles.length} excel files.`);

        for (const excelFile of excelFiles) {
            const nameBase = path.parse(excelFile).name;
            const excelPath = path.join(SHEETS_DIR, excelFile);

            // Buscar video correspondiente (asumimos .mp4)
            const videoPath = path.join(VIDEOS_DIR, nameBase + '.mp4');

            if (fs.existsSync(videoPath)) {
                await processPair(videoPath, excelPath, OUTPUT_DIR);
            } else {
                console.warn(`⚠️  Salteando ${excelFile}: No se encontró video "${nameBase}.mp4" en source/videos`);
            }
        }

    } else {
        // MODO INDIVIDUAL
        await processPair(argv.video, argv.excel, OUTPUT_DIR);
    }

    console.log('\n🏁 ¡Todo el proceso ha terminado!');
};


// Helper para convertir "MM:SS" o números a segundos
function parseTime(input) {
    if (input === undefined || input === null || input === '') return null;
    const str = String(input).trim();
    if (str.includes(':')) {
        const parts = str.split(':');
        let seconds = 0;
        if (parts.length === 3) {
            seconds = (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
        } else if (parts.length === 2) {
            seconds = (+parts[0]) * 60 + (+parts[1]);
        }
        return seconds;
    }
    return parseFloat(str);
}

// Helper para mostrar segundos bonitos en consola
function formatSeconds(seconds) {
    return new Date(seconds * 1000).toISOString().substr(11, 8);
}

// Ejecutar
main();