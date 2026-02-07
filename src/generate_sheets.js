const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const CSV_FILE = path.join(__dirname, 'files.csv');
const VIDEOS_DIR = path.join(__dirname, 'source/videos');
const SHEETS_DIR = path.join(__dirname, 'source/sheets');

if (!fs.existsSync(SHEETS_DIR)) {
    fs.mkdirSync(SHEETS_DIR, { recursive: true });
}

let videoFiles = [];
if (fs.existsSync(VIDEOS_DIR)) {
    videoFiles = fs.readdirSync(VIDEOS_DIR);
} else {
    console.warn(`⚠️  Directorio de videos no encontrado: ${VIDEOS_DIR}. Se usarán los nombres del CSV.`);
}

function findVideoFile(partialName) {
    if (!partialName) return null;
    const search = partialName.trim();
    // Intento 1: búsqueda exacta de substring
    for (const file of videoFiles) {
        if (file.includes(search)) {
            return file;
        }
    }
    // Intento 2: Sin extensión
    const searchNoExt = search.replace(/\.mp4$/i, '');
    if (searchNoExt !== search) {
        for (const file of videoFiles) {
            if (file.includes(searchNoExt)) {
                return file;
            }
        }
    }
    return null;
}

function parseCSVLine(text) {
    const res = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            // Manejo de comillas dobles escapadas "" -> " si fuera necesario, 
            // pero csv simple suele ser switch. Aqui asumimos switch.
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            res.push(cur.trim());
            cur = '';
        } else {
            cur += char;
        }
    }
    res.push(cur.trim());
    return res;
}

const content = fs.readFileSync(CSV_FILE, 'utf-8');
const lines = content.split(/\r?\n/);

let currentXlsxName = null;
let currentData = [];

function saveCurrentSheet() {
    if (!currentXlsxName || currentData.length === 0) return;

    // Crear workbook
    const wb = xlsx.utils.book_new();
    // Headers explícitos
    const ws = xlsx.utils.json_to_sheet(currentData, { header: ["nombre", "inicio", "fin"] });
    xlsx.utils.book_append_sheet(wb, ws, "Sheet1");

    // Asegurar extensión .xlsx
    let fileName = currentXlsxName;

    // Si el nombre viene del video (ej: algo.mp4), quitamos mp4
    if (fileName.toLowerCase().endsWith('.mp4')) {
        fileName = fileName.substring(0, fileName.length - 4);
    }
    if (!fileName.toLowerCase().endsWith('.xlsx')) {
        fileName += '.xlsx';
    }

    const outputPath = path.join(SHEETS_DIR, fileName);
    xlsx.writeFile(wb, outputPath);
    console.log(`✅ Guardado: ${fileName} (${currentData.length} filas)`);
}

console.log('🚀 Iniciando generación de Excel...');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = parseCSVLine(line);
    const firstCol = parts[0] ? parts[0].toLowerCase() : '';

    if (firstCol.startsWith('video ')) {
        // Guardar el anterior si existe
        saveCurrentSheet();

        // Preparar nuevo
        currentData = [];
        const partialName = parts[1];

        if (!partialName) {
            console.warn(`⚠️  Línea ${i + 1}: Tag 'Video' sin nombre de archivo asociado.`);
            currentXlsxName = null;
            continue;
        }

        const match = findVideoFile(partialName);
        if (match) {
            // Usar el nombre real del archivo de video para el excel
            currentXlsxName = match;
            console.log(`\n📹 Video encontrado: "${match}" (match con "${partialName}")`);
        } else {
            console.warn(`\n⚠️  No se encontró video para "${partialName}". Se usará este nombre.`);
            currentXlsxName = partialName;
        }

    } else if (firstCol === 'nombre' && parts[1] && parts[1].toLowerCase() === 'inicio') {
        // Es la cabecera, ignorar
        continue;
    } else {
        // Asumimos que es data si tenemos un archivo abierto
        if (currentXlsxName) {
            // Validar que tenga datos mínimos
            if (parts.length >= 1) {
                currentData.push({
                    nombre: parts[0],
                    inicio: parts[1] || '',
                    fin: parts[2] || ''
                });
            }
        }
    }
}

// Guardar el último
saveCurrentSheet();
console.log('\n✨ Proceso completado.');
