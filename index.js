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
        description: 'Ruta del archivo de video'
    })
    .option('excel', {
        alias: 'e',
        type: 'string',
        default: 'source/sheets/video_0.xlsx',
        description: 'Ruta del archivo Excel'
    })
    .option('output', {
        alias: 'o',
        type: 'string',
        default: './output',
        description: 'Carpeta de salida'
    })
    .argv;

const VIDEO_FILE = argv.video;
const EXCEL_FILE = argv.excel;
const OUTPUT_DIR = argv.output;

// Mapeo de columnas (debe coincidir con la cabecera de tu Excel, minúsculas/mayúsculas da igual)
const COL_START = 'inicio';
const COL_END = 'fin';
const COL_NAME = 'nombre';
// ---------------------

const processExcel = async () => {
    // Definir carpeta de salida específica basada en el nombre del video
    const videoName = path.parse(VIDEO_FILE).name;
    const FINAL_OUTPUT_DIR = path.join(OUTPUT_DIR, videoName);

    if (!fs.existsSync(FINAL_OUTPUT_DIR)) {
        fs.mkdirSync(FINAL_OUTPUT_DIR, { recursive: true });
    }

    console.log(`📂 Carpeta de salida: ${FINAL_OUTPUT_DIR}`);
    console.log('📊 Leyendo Excel...');

    // Leer el archivo y convertir la primera hoja a JSON
    const workbook = xlsx.readFile(EXCEL_FILE);
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
            replacement: '_',  // reemplaza espacios con reemplazo
            remove: /[*+~.()'"!:@]/g, // regex para remover caracteres
            lower: true,      // resultado en minúsculas
            strict: true      // elimina caracteres especiales excepto reemplazo
        });

        const fileName = cleanName + '.mp4';
        const outputPath = path.join(FINAL_OUTPUT_DIR, fileName);

        console.log(`[${index + 1}/${data.length}] ✂️  Procesando: "${fileName}"`);
        console.log(`   ⏱️  Tiempo: ${formatSeconds(startTime)} -> ${endTime ? formatSeconds(endTime) : 'FIN'}`);

        // Input Seeking: -ss antes del input para rapidez y precisión sin re-encoding
        const inputOptions = [
            `-ss ${startTime}`
        ];

        const outputOptions = [
            '-c copy',          // COPIA DIRECTA (Sin recodificar)
            '-map 0'            // Copia todos los tracks (audio y video)
        ];

        if (endTime) {
            const duration = endTime - startTime;
            if (duration > 0) {
                outputOptions.push(`-t ${duration}`); // Duración del clip
            } else {
                console.warn(`⚠️  Duración inválida (${duration}s) para ${fileName}. Se omitirá el corte final.`);
            }
        }

        await new Promise((resolve, reject) => {
            ffmpeg(VIDEO_FILE)
                .inputOptions(inputOptions)
                .outputOptions(outputOptions)
                .output(outputPath)
                .on('end', () => {
                    resolve();
                })
                .on('error', (err) => {
                    console.error(`❌ Error en ${fileName}:`, err.message);
                    // Resolvemos en vez de Reject para que el script siga con el siguiente
                    resolve();
                })
                .run();
        });
    }

    console.log('✅ ¡Proceso finalizado con éxito!');
};

// Helper para convertir "MM:SS" o números a segundos
function parseTime(input) {
    if (input === undefined || input === null || input === '') return null;

    // Si es número, asumimos que ya son segundos (si el usuario pone 5 en excel y es número)
    // OJO: Excel a veces devuelve fracciones de día para celdas de tiempo.
    // Asumiremos que el usuario ingresa TEXTO "MM:SS" como pidió.
    // Si llega un string
    const str = String(input).trim();

    if (str.includes(':')) {
        const parts = str.split(':');
        // Soporta H:MM:SS o MM:SS
        let seconds = 0;
        if (parts.length === 3) {
            seconds = (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
        } else if (parts.length === 2) {
            seconds = (+parts[0]) * 60 + (+parts[1]);
        }
        return seconds;
    }

    // Si es solo números (ej: "120" o 120), devolvemos tal cual
    return parseFloat(str);
}

// Helper para mostrar segundos bonitos en consola
function formatSeconds(seconds) {
    return new Date(seconds * 1000).toISOString().substr(11, 8);
}

processExcel();