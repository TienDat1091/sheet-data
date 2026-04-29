const elements = {
    sheetList: document.getElementById('sheetList'),
    filesList: document.getElementById('filesList'),
    fileInput: document.getElementById('fileInput'),
    currentSheetName: document.getElementById('currentSheetName'),
    tableHead: document.getElementById('tableHead'),
    tableBody: document.getElementById('tableBody'),
    tableContainer: document.getElementById('tableContainer'),
    infoBanner: document.getElementById('infoBanner'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    refreshBtn: document.getElementById('refreshBtn'),
    saveBtn: document.getElementById('saveBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    saveStatus: document.getElementById('saveStatus'),
    dbTypeSelect: document.getElementById('dbTypeSelect'),
    genSqlBtn: document.getElementById('genSqlBtn'),
    sqlModal: document.getElementById('sqlModal'),
    sqlOutput: document.getElementById('sqlOutput'),
    closeSqlBtn: document.getElementById('closeSqlBtn'),
    copySqlBtn: document.getElementById('copySqlBtn'),
    compareBtn: document.getElementById('compareBtn'),
    compareModal: document.getElementById('compareModal'),
    closeCompareBtn: document.getElementById('closeCompareBtn'),
    compareFile1: document.getElementById('compareFile1'),
    compareSheet1: document.getElementById('compareSheet1'),
    compareFile2: document.getElementById('compareFile2'),
    compareSheet2: document.getElementById('compareSheet2'),
    runCompareBtn: document.getElementById('runCompareBtn'),
    compareResults: document.getElementById('compareResults'),
    compareSummary: document.getElementById('compareSummary'),
    compareDetails: document.getElementById('compareDetails')
};

let currentSheet = null;
let currentData = null;
let currentWorkbook = null;
let currentFileName = "";
let uploadedFiles = {}; // filename => { arrayBuffer, workbook }

const knowledgeBase = {
    VNKR: { routeAllData: [], repairFrequencyMap: new Map(), grpToSectionMap: new Map() },
    VNFB: { routeAllData: [], repairFrequencyMap: new Map(), grpToSectionMap: new Map() }
};
let taoRepairMap = new Map();

async function init() {
    setupEventListeners();
    await loadKnowledgeBases();
}

function setupEventListeners() {
    elements.fileInput.addEventListener('change', handleFileUpload);
    if (elements.refreshBtn) elements.refreshBtn.addEventListener('click', () => { if (currentSheet) loadData(currentSheet); });
    if (elements.saveBtn) elements.saveBtn.addEventListener('click', saveToFile);
    if (elements.downloadBtn) elements.downloadBtn.addEventListener('click', downloadFile);
    if (elements.genSqlBtn) elements.genSqlBtn.addEventListener('click', generateSQL);
    if (elements.closeSqlBtn) elements.closeSqlBtn.addEventListener('click', () => elements.sqlModal.style.display = 'none');
    if (elements.copySqlBtn) elements.copySqlBtn.addEventListener('click', () => {
        elements.sqlOutput.select();
        document.execCommand('copy');
        alert("Copied to clipboard!");
    });

    // Compare Files
    if (elements.compareBtn) elements.compareBtn.addEventListener('click', openCompareModal);
    if (elements.closeCompareBtn) elements.closeCompareBtn.addEventListener('click', () => elements.compareModal.style.display = 'none');
    if (elements.runCompareBtn) elements.runCompareBtn.addEventListener('click', runComparison);
    if (elements.compareFile1) elements.compareFile1.addEventListener('change', (e) => loadSheetsForCompare(e.target.value, 1));
    if (elements.compareFile2) elements.compareFile2.addEventListener('change', (e) => loadSheetsForCompare(e.target.value, 2));

    elements.tableContainer.addEventListener('input', () => { if(elements.saveStatus) elements.saveStatus.textContent = 'Typing...'; setTimeout(saveToFile, 2000); });
}


function showLoading(show) {
    if(elements.loadingOverlay) elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

// -------------------------------------------------------------
// Knowledge Base Loading
// -------------------------------------------------------------
async function loadKnowledgeBases() {
    showLoading(true);
    try {
        await loadRemoteDB('ROUTE_ALL.xls', 'VNKR');
        await loadRemoteDB('VNFB.xls', 'VNFB');
        await loadTaoRepair('Ho tro tao all - Copy - Copy.xlsx');
        console.log("Knowledge Bases Loaded!");
    } catch(e) {
        console.error("Error loading knowledge bases (files maybe missing or too large): ", e);
    }
    showLoading(false);
}

async function loadRemoteDB(filename, dbKey) {
    try {
        const res = await fetch(`./${filename}`);
        if (!res.ok) return;
        const ab = await res.arrayBuffer();
        const wb = XLSX.read(ab, {type: 'array'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        buildGlobalKnowledge(data, dbKey);
    } catch(e) { console.warn("Could not load " + filename); }
}

function buildGlobalKnowledge(data, dbKey) {
    const db = knowledgeBase[dbKey];
    db.routeAllData = data;
    const pairCounts = {};
    data.forEach(r => {
        const grp = r.GRP ? r.GRP.toString().trim() : null;
        const section = r.SECTION ? r.SECTION.toString().trim() : null;
        if (grp && section) db.grpToSectionMap.set(grp, section);

        if (r.RTYPE2 === 'B' && r.MSTEP && r.OSTEP && r.MSTEP !== '0' && r.OSTEP !== '0') {
            const mStepStr = r.MSTEP.toString().trim();
            const oStepStr = r.OSTEP.toString().trim();
            const sourceGrp = oStepStr.length >= 3 ? oStepStr.slice(-3) : oStepStr;
            const targetGrp = mStepStr.length >= 3 ? mStepStr.slice(-3) : mStepStr;
            if (sourceGrp && targetGrp && sourceGrp !== 'ZZZ' && targetGrp !== 'ZZZ') {
                if (!pairCounts[sourceGrp]) pairCounts[sourceGrp] = {};
                pairCounts[sourceGrp][targetGrp] = (pairCounts[sourceGrp][targetGrp] || 0) + 1;
            }
        }
    });

    for (const src in pairCounts) {
        const targets = pairCounts[src];
        const mostFrequent = Object.keys(targets).reduce((a, b) => targets[a] > targets[b] ? a : b);
        db.repairFrequencyMap.set(src, mostFrequent);
    }
}

async function loadTaoRepair(filename) {
    try {
        const res = await fetch(`./${filename}`);
        if (!res.ok) return;
        const ab = await res.arrayBuffer();
        const wb = XLSX.read(ab, {type: 'array'});
        const sheet = wb.Sheets["TaoRepair"];
        if (sheet) {
            XLSX.utils.sheet_to_json(sheet).forEach(row => {
                if (row.ROUTE && row.RIDX && row['CODE SQL']) taoRepairMap.set(`${row.ROUTE}_${row.RIDX}`, row['CODE SQL']);
            });
        }
    } catch(e) { console.warn("Could not load tao repair: " + filename); }
}

// -------------------------------------------------------------
// File Handlers
// -------------------------------------------------------------
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if(!file) return;
    showLoading(true);
    
    currentFileName = file.name;
    const reader = new FileReader();
    reader.onload = function(evt) {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        uploadedFiles[currentFileName] = { data, workbook };
        currentWorkbook = workbook;
        renderFileList();
        selectFile(currentFileName);
        showLoading(false);
    };
    reader.readAsArrayBuffer(file);
}

function renderFileList() {
    elements.filesList.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'file-item active';
    div.dataset.filename = currentFileName;
    div.innerHTML = `<span class="file-name">${currentFileName}</span>`;
    elements.filesList.appendChild(div);
}

function selectFile(filename) {
    if(!uploadedFiles[filename]) return;
    currentWorkbook = uploadedFiles[filename].workbook;
    elements.sheetList.innerHTML = '';
    
    currentWorkbook.SheetNames.forEach(sheet => {
        const div = document.createElement('div');
        div.className = 'sheet-item';
        div.textContent = sheet;
        div.onclick = () => selectSheet(sheet, div);
        elements.sheetList.appendChild(div);
    });
    
    elements.tableContainer.style.display = 'none';
    elements.infoBanner.style.display = 'flex';
}

function selectSheet(sheetName, element) {
    document.querySelectorAll('.sheet-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    currentSheet = sheetName;
    elements.currentSheetName.textContent = sheetName;
    loadData(sheetName);
}

function loadData(sheetName) {
    elements.infoBanner.style.display = 'none';
    const sheet = currentWorkbook.Sheets[sheetName];
    currentData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    renderTable(currentData);
    elements.tableContainer.style.display = 'block';
    if(elements.saveBtn) elements.saveBtn.style.display = 'block';
}

function renderTable(data) {
    elements.tableHead.innerHTML = '';
    elements.tableBody.innerHTML = '';
    if (!data || data.length === 0) return;

    const headers = data[0];
    const rows = data.slice(1);
    const trHead = document.createElement('tr');
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h || '';
        trHead.appendChild(th);
    });
    elements.tableHead.appendChild(trHead);

    const frag = document.createDocumentFragment();
    rows.forEach(r => {
        const tr = document.createElement('tr');
        for (let i = 0; i < headers.length; i++) {
            const td = document.createElement('td');
            td.contentEditable = true;
            td.textContent = r[i] !== undefined ? r[i] : '';
            tr.appendChild(td);
        }
        frag.appendChild(tr);
    });
    elements.tableBody.appendChild(frag);
}

function getDataFromTable() {
    const headers = [];
    elements.tableHead.querySelectorAll('th').forEach(th => headers.push(th.textContent));
    const rows = [];
    elements.tableBody.querySelectorAll('tr').forEach(tr => {
        const row = [];
        tr.querySelectorAll('td').forEach(td => row.push(td.textContent));
        rows.push(row);
    });
    return [headers, ...rows];
}

function saveToFile() {
    if(!currentSheet || !currentWorkbook) return;
    currentData = getDataFromTable();
    currentWorkbook.Sheets[currentSheet] = XLSX.utils.aoa_to_sheet(currentData);
    if(elements.saveStatus) elements.saveStatus.textContent = 'Trạng thái dữ liệu đã cập nhật';
}

function downloadFile() {
    if(!currentWorkbook) return alert("Không có file");
    XLSX.writeFile(currentWorkbook, "Exported_" + currentFileName);
}

// -------------------------------------------------------------
// SQL Generation Logic (Migrated from Server)
// -------------------------------------------------------------
function generateSQL() {
    if (!currentWorkbook || !currentSheet) return alert("Vui lòng chọn sheet.");
    showLoading(true);

    const modeRadio = document.querySelector('input[name="sqlMode"]:checked');
    const mode = modeRadio ? modeRadio.value : 'normal';
    const prefixInput = document.getElementById('stepPrefixInput');
    const newPrefix = prefixInput ? prefixInput.value.trim().toUpperCase() : '';
    const dbType = elements.dbTypeSelect ? elements.dbTypeSelect.value : 'VNKR';

    const sheet = currentWorkbook.Sheets[currentSheet];
    const rawData = XLSX.utils.sheet_to_json(sheet); // Array of objects
    
    let sqlOutput = "";
    let sqlEntryCount = 0;
    
    const replacePrefix = (stepName, newPrefix) => {
        if (!newPrefix || newPrefix.length !== 4) return stepName;
        if (!stepName || stepName.toString().trim() === '0') return stepName;
        const step = stepName.toString().trim();
        if (step.length < 4) return step;
        return newPrefix + step.substring(4);
    };

    if (mode === 'normal') {
        const columns = "ROUTE,RIDX,STEP,STEPTIME,TIMESTEP,STEPSTAY,LOWSTEPTIME,LOWTIMESTEP,RTYPE1,RTYPE2,RTYPE3,MSTEP,OSTEP,SECTION,GRP,STEPFLAG,STEPFLAG1,STEPFLAG2,STEPFLAG3,KP1,KP2,KP3,TOKP,CHKKP1,CHKKP2,KPMODE,STEPNM";
        rawData.forEach(row => {
            const stepValue = row.STEP || row.STEPNM || '';
            const ridx = parseInt(row.RIDX);
            if (!row.RIDX || !row.ROUTE || isNaN(ridx)) return;

            sqlEntryCount++;
            sqlOutput += `-- No: ${sqlEntryCount}\n`;
            const route = (row.ROUTE || '').toString();
            const step = replacePrefix(stepValue.toString().trim(), newPrefix);
            const steptime = row.STEPTIME || 0;
            const timestep = row.TIMESTEP || 0;
            const stepstay = row.STEPSTAY || 0;
            const lowsteptime = row.LOWSTEPTIME || 0;
            const lowtimestep = row.LOWTIMESTEP || 0;
            const rtype1 = (row.RTYPE1 || '').toString();
            const rtype2 = (row.RTYPE2 || 'N').toString();
            const rtype3 = (row.RTYPE3 || '').toString();
            const mstep = replacePrefix((row.MSTEP || '0').toString(), newPrefix);
            const ostep = replacePrefix((row.OSTEP || '0').toString(), newPrefix);
            const section = (row.SECTION || '').toString();
            const grp = (row.GRP || '').toString();
            const stepflag = (row.STEPFLAG || '').toString();
            const stepflag1 = (row.STEPFLAG1 || '').toString();
            const stepflag2 = (row.STEPFLAG2 || '').toString();
            const stepflag3 = (row.STEPFLAG3 || '').toString();
            const kp1 = (row.KP1 || '').toString();
            const kp2 = (row.KP2 || '').toString();
            const kp3 = (row.KP3 || '').toString();
            const tokp = (row.TOKP || '').toString();
            const chkkp1 = (row.CHKKP1 || '').toString();
            const chkkp2 = (row.CHKKP2 || '').toString();
            const kpmode = (row.KPMODE || '').toString();
            const stepnm = (row.STEPNM || '').toString();

            sqlOutput += `INSERT INTO route_step (${columns}) values('${route}','${ridx}','${step}',${steptime},${timestep},${stepstay},${lowsteptime},${lowtimestep},'${rtype1}','${rtype2}','${rtype3}','${mstep}','${ostep}','${section}','${grp}','${stepflag}','${stepflag1}','${stepflag2}','${stepflag3}','${kp1}','${kp2}','${kp3}','${tokp}','${chkkp1}','${chkkp2}','${kpmode}','${stepnm}');\n\n`;
        });
    } else {
        // REPAIR MODE
        const selectedDB = knowledgeBase[dbType] || knowledgeBase.VNKR;
        const { routeAllData, repairFrequencyMap, grpToSectionMap } = selectedDB;
        const alphaSeq = ['Z', 'Y', 'X', 'V', 'W', 'M', 'N', 'J', 'K', 'L'];
        
        rawData.forEach((row, rowIndex) => {
            const stepValue = row.STEP || row.STEPNM;
            if (!row.RIDX || !stepValue || !row.ROUTE || !row.REPAIR) return;

            sqlEntryCount++;
            sqlOutput += `-- No: ${sqlEntryCount}\n`;
            const originalRidx = parseInt(row.RIDX);
            const originalStep = stepValue.toString().trim();
            const route = row.ROUTE;
            const ruleKey = `${route}_${originalRidx}`;

            if (taoRepairMap.has(ruleKey)) {
                sqlOutput += `-- Rule from TaoRepair\n${taoRepairMap.get(ruleKey)}\n\n`;
                return;
            }

            const originalSection = (row.SECTION || "").toString().trim();
            const originalPrefix = originalStep.length >= 4 ? originalStep.slice(0, 4) : "MHBI";
            const basePrefix = (newPrefix && newPrefix.length === 4) ? newPrefix : originalPrefix;

            const getPrefix = (grp, fallback) => {
                const sec = grpToSectionMap.get(grp);
                return sec ? sec.charAt(0).toUpperCase() : (fallback ? fallback.charAt(0).toUpperCase() : "X");
            };

            const repairGrpsList = row.REPAIR.toString().split(/[，,;]/).map(s => s.trim()).filter(s => s.length > 0);
            if (repairGrpsList.length === 0) return;

            const firstSourceGrp = repairGrpsList[0];
            let targetGrp = repairFrequencyMap.get(firstSourceGrp);
            let knowledgeFound = !!targetGrp;

            if (!knowledgeFound) {
                const localSelfMatch = rawData.find(r => r.ROUTE === route && r.GRP && r.GRP.toString().trim() === firstSourceGrp);
                if (localSelfMatch) {
                    targetGrp = firstSourceGrp;
                    knowledgeFound = true;
                }
            }

            if (!knowledgeFound) {
                const currentSearchStep = originalStep;
                const localIdx = rawData.findIndex(r => r.ROUTE === route && (r.STEP === currentSearchStep || r.STEPNM === currentSearchStep));
                if (localIdx !== -1 && localIdx + 1 < rawData.length && rawData[localIdx + 1].ROUTE === route) {
                    targetGrp = rawData[localIdx + 1].GRP;
                    knowledgeFound = true;
                } else {
                    const searchStepName = `${basePrefix}${getPrefix(firstSourceGrp, originalSection)}${firstSourceGrp}`;
                    const globalIdx = routeAllData.findIndex(r => r.ROUTE === route && (r.STEP === searchStepName || r.STEPNM === searchStepName));
                    if (globalIdx !== -1 && globalIdx + 1 < routeAllData.length && routeAllData[globalIdx + 1].ROUTE === route) {
                        targetGrp = routeAllData[globalIdx + 1].GRP;
                        knowledgeFound = true;
                    } else {
                        targetGrp = firstSourceGrp + "1";
                        knowledgeFound = false;
                    }
                }
            }
            if (!targetGrp) targetGrp = firstSourceGrp;

            const targetSecPrefix = getPrefix(targetGrp, originalSection);
            const targetSecName = grpToSectionMap.get(targetGrp) || originalSection;
            const buildName = (pref, mid, grp) => `${pref}${mid}${grp}`;
            const repairStepFinal = buildName(basePrefix, targetSecPrefix, targetGrp);
            const repairMStepSourcePrefix = getPrefix(firstSourceGrp, originalSection);
            const repairMStep = buildName(basePrefix, repairMStepSourcePrefix, firstSourceGrp);
            const columns = "ROUTE,RIDX,STEP,STEPTIME,TIMESTEP,STEPSTAY,LOWSTEPTIME,LOWTIMESTEP,RTYPE1,RTYPE2,RTYPE3,MSTEP,OSTEP,SECTION,GRP,STEPFLAG,STEPFLAG1,STEPFLAG2,STEPFLAG3,KP1,KP2,KP3,TOKP,CHKKP1,CHKKP2,KPMODE,STEPNM";

            let currentRidx = originalRidx * 10000;
            repairGrpsList.forEach((currentGrp, i) => {
                const currentSourceSecPrefix = getPrefix(currentGrp, originalSection);
                const currentSourceStepFull = buildName(basePrefix, currentSourceSecPrefix, currentGrp);
                const rollbackStep = buildName(basePrefix, alphaSeq[i % alphaSeq.length], targetGrp);
                
                if (i === 0) {
                    currentRidx++;
                    sqlOutput += `INSERT INTO route_step (${columns}) values('${route}','${currentRidx}','${repairStepFinal}',0,0,0,0,0,'','R','','${repairMStep}','0','${targetSecName}','${targetGrp}','','','','','','','','','','','','');\n`;
                    currentRidx++;
                    sqlOutput += `INSERT INTO route_step (${columns}) values('${route}','${currentRidx}','${rollbackStep}',0,0,0,0,0,'','B','','${repairMStep}','${currentSourceStepFull}','BACK','ZZZ','','','','','','','','','','','','');\n`;
                } else {
                    currentRidx++;
                    sqlOutput += `INSERT INTO route_step (${columns}) values('${route}','${currentRidx}','${rollbackStep}',0,0,0,0,0,'','B','','${repairMStep}','${currentSourceStepFull}','BACK','ZZZ','','','','','','','','','','','','');\n`;
                }
            });
            sqlOutput += "\n";
        });
    }

    elements.sqlOutput.value = sqlOutput || "-- No SQL Generated";
    elements.sqlModal.style.display = 'flex';
    showLoading(false);
}

// -------------------------------------------------------------
// Compare Files Logic (Frontend-only, multi-file upload)
// -------------------------------------------------------------

// Lưu các workbook đã upload riêng cho Compare
let compareWorkbooks = {}; // filename => workbook

function openCompareModal() {
    // Điền dropdown từ các file đã upload sẵn
    const filenames = Object.keys(uploadedFiles);
    const fileOptions = filenames.map(f => `<option value="${f}">${f}</option>`).join('');
    elements.compareFile1.innerHTML = '<option value="">-- Chọn File đã upload --</option>' + fileOptions;
    elements.compareFile2.innerHTML = '<option value="">-- Chọn File đã upload --</option>' + fileOptions;
    elements.compareModal.style.display = 'flex';
    elements.compareResults.style.display = 'none';
}

// Upload file trực tiếp trong modal Compare
function handleCompareFileUpload(event, fileNum) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        uploadedFiles[file.name] = { data, workbook: wb };

        // Thêm vào dropdown và chọn luôn
        const selectEl = fileNum === 1 ? elements.compareFile1 : elements.compareFile2;
        // Thêm option nếu chưa có
        if (!selectEl.querySelector(`option[value="${file.name}"]`)) {
            const opt = document.createElement('option');
            opt.value = file.name;
            opt.textContent = file.name;
            selectEl.appendChild(opt);
        }
        selectEl.value = file.name;
        loadSheetsForCompare(file.name, fileNum);
    };
    reader.readAsArrayBuffer(file);
}


function loadSheetsForCompare(filename, fileNum) {
    if (!filename || !uploadedFiles[filename]) return;
    const wb = uploadedFiles[filename].workbook;
    const sheetOptions = wb.SheetNames.map(s => `<option value="${s}">${s}</option>`).join('');
    const selectEl = fileNum === 1 ? elements.compareSheet1 : elements.compareSheet2;
    selectEl.innerHTML = `<option value="">-- Chọn Sheet ${fileNum} --</option>` + sheetOptions;
}

function runComparison() {
    const file1 = elements.compareFile1.value;
    const sheet1 = elements.compareSheet1.value;
    const file2 = elements.compareFile2.value;
    const sheet2 = elements.compareSheet2.value;

    if (!file1 || !sheet1 || !file2 || !sheet2) {
        return alert('Vui lòng chọn đủ 2 file và 2 sheet để so sánh.');
    }

    showLoading(true);

    const wb1 = uploadedFiles[file1].workbook;
    const wb2 = uploadedFiles[file2].workbook;
    const data1 = XLSX.utils.sheet_to_json(wb1.Sheets[sheet1]);
    const data2 = XLSX.utils.sheet_to_json(wb2.Sheets[sheet2]);

    const keyColumns = ['ROUTE', 'RIDX'];
    const createKey = (row) => keyColumns.map(col => String(row[col] || '')).join('|');

    const map1 = new Map();
    const map2 = new Map();
    data1.forEach(row => map1.set(createKey(row), row));
    data2.forEach(row => map2.set(createKey(row), row));

    const differences = [];
    let matchingRows = 0;
    let differentRows = 0;

    map1.forEach((row1, key) => {
        if (!map2.has(key)) {
            const keyObj = {};
            keyColumns.forEach((col, i) => keyObj[col] = key.split('|')[i]);
            differences.push({ key: keyObj, status: 'missing', file1Values: row1, file2Values: null });
        } else {
            const row2 = map2.get(key);
            const allColumns = [...new Set([...Object.keys(row1), ...Object.keys(row2)])];
            const diffColumns = allColumns.filter(col => String(row1[col] !== undefined ? row1[col] : '') !== String(row2[col] !== undefined ? row2[col] : ''));
            if (diffColumns.length > 0) {
                const keyObj = {};
                keyColumns.forEach((col, i) => keyObj[col] = key.split('|')[i]);
                differences.push({ key: keyObj, status: 'different', diffColumns, file1Values: row1, file2Values: row2 });
                differentRows++;
            } else {
                matchingRows++;
            }
        }
    });

    map2.forEach((row2, key) => {
        if (!map1.has(key)) {
            const keyObj = {};
            keyColumns.forEach((col, i) => keyObj[col] = key.split('|')[i]);
            differences.push({ key: keyObj, status: 'extra', file1Values: null, file2Values: row2 });
        }
    });

    const summary = {
        totalRows1: data1.length, totalRows2: data2.length,
        matchingRows, differentRows,
        onlyInFile1: [...map1.keys()].filter(k => !map2.has(k)).length,
        onlyInFile2: [...map2.keys()].filter(k => !map1.has(k)).length
    };

    displayComparisonResults({ summary, differences });
    showLoading(false);
}

function displayComparisonResults(result) {
    const { summary, differences } = result;

    elements.compareSummary.innerHTML = `
        <h4 style="margin: 0 0 10px 0;">📊 Kết quả So sánh</h4>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.9rem;">
            <div style="background: rgba(16,185,129,0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #10b981;">
                <div style="color:#10b981; font-weight:bold;">${summary.matchingRows}</div>
                <div style="color:#94a3b8;">Dòng Giống Nhau</div>
            </div>
            <div style="background: rgba(239,68,68,0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #ef4444;">
                <div style="color:#ef4444; font-weight:bold;">${summary.differentRows}</div>
                <div style="color:#94a3b8;">Dòng Khác Nhau</div>
            </div>
            <div style="background: rgba(245,158,11,0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #f59e0b;">
                <div style="color:#f59e0b; font-weight:bold;">${summary.onlyInFile1 + summary.onlyInFile2}</div>
                <div style="color:#94a3b8;">Dòng Thiếu / Thừa</div>
            </div>
        </div>
        <div style="margin-top:10px; font-size:0.85rem; color:#94a3b8;">
            Tổng: ${summary.totalRows1} dòng ở File 1, ${summary.totalRows2} dòng ở File 2
        </div>`;

    if (differences.length === 0) {
        elements.compareDetails.innerHTML = '<div style="text-align:center; padding:20px; color:#10b981;">✅ Hai file hoàn toàn giống nhau!</div>';
    } else {
        let html = '<div style="font-size:0.85rem;">';
        differences.forEach(diff => {
            const color = diff.status === 'different' ? '#ef4444' : '#f59e0b';
            const label = diff.status === 'different' ? 'Khác Giá Trị' : (diff.status === 'missing' ? 'Chỉ có ở File 1' : 'Chỉ có ở File 2');
            html += `<div style="background:rgba(0,0,0,0.3); padding:12px; border-radius:4px; margin-bottom:10px; border-left:3px solid ${color};">
                <div style="font-weight:bold; color:${color}; margin-bottom:5px;">${label}: ROUTE=${diff.key.ROUTE}, RIDX=${diff.key.RIDX}</div>`;
            if (diff.status === 'different' && diff.diffColumns) {
                html += '<div>';
                diff.diffColumns.forEach(col => {
                    const v1 = diff.file1Values[col] !== undefined ? diff.file1Values[col] : 'N/A';
                    const v2 = diff.file2Values[col] !== undefined ? diff.file2Values[col] : 'N/A';
                    html += `<div style="margin-bottom:4px; padding-left:10px;">
                        <span style="color:#94a3b8;">${col}:</span>
                        <span style="color:#10b981;">${v1}</span>
                        <span style="color:#64748b;"> → </span>
                        <span style="color:#ef4444;">${v2}</span>
                    </div>`;
                });
                html += '</div>';
            }
            html += '</div>';
        });
        html += '</div>';
        elements.compareDetails.innerHTML = html;
    }

    elements.compareResults.style.display = 'block';
}

init();
