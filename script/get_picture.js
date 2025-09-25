
/* ====== COMPLETE JS (replace existing <script>) ====== */

/* State */
let db;
let currentImagesData = []; // add-form images (dataURL objects)
let perPage = 10;
let currentPage = 1;
let selectedNotes = new Set();
let currentFilter = { start: null, end: null };
let currentSearch = '';

// Edit modal local state (isolated copy until save)
let editingId = null;
let editExistingImages = []; // copied from note when opening modal
let editNewImages = []; // newly added in modal (not saved yet)

/* IndexedDB init */
const request = indexedDB.open("MyNotesDB", 5);
request.onupgradeneeded = function(e) {
  db = e.target.result;
  if (!db.objectStoreNames.contains("notes")) {
    const store = db.createObjectStore("notes", { keyPath: "id", autoIncrement: true });
    store.createIndex("timestamp", "timestamp", { unique: false });
  }
};
request.onsuccess = function(e) {
  db = e.target.result;
  const addBtn = document.getElementById('addBtn');
  if (addBtn) addBtn.disabled = false;
  updateCurrentTime();
  displayNotes();
  updateNotesStats();
};
request.onerror = function(e) { console.error("IndexedDB error", e); alert("Lỗi mở DB"); };

/* Time display */
function updateCurrentTime() {
  const el = document.getElementById('currentTime');
  if (!el) return;
  function tick() {
    el.textContent = new Date().toLocaleString('vi-VN', { hour12:false });
    setTimeout(tick, 1000);
  }
  tick();
}

/* Helpers */
function showNotification(msg, isError=false) {
  const n = document.createElement('div');
  n.textContent = msg;
  n.style.position='fixed';
  n.style.right='18px';
  n.style.top='18px';
  n.style.padding='10px 14px';
  n.style.borderRadius='8px';
  n.style.zIndex=9999;
  n.style.background = isError ? '#e53935' : '#4caf50';
  n.style.color = '#fff';
  n.style.fontWeight='600';
  document.body.appendChild(n);
  setTimeout(()=>n.remove(), 2600);
}
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}

/* ----------------- Add form image handling (separate) ----------------- */
const imageInput = document.getElementById('image');
const imageUploadArea = document.getElementById('imageUploadArea');

if (imageInput) {
  imageInput.addEventListener('change', function() {
    const files = Array.from(this.files || []);
    files.forEach(f => handleImageFileForAdd(f));
    this.value = '';
  });
}
if (imageUploadArea) {
  imageUploadArea.addEventListener('dragover', e => { e.preventDefault(); imageUploadArea.classList.add('dragover'); });
  imageUploadArea.addEventListener('dragleave', e => { e.preventDefault(); imageUploadArea.classList.remove('dragover'); });
  imageUploadArea.addEventListener('drop', e => {
    e.preventDefault(); imageUploadArea.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files || []);
    files.forEach(f => { if (f.type && f.type.startsWith('image/')) handleImageFileForAdd(f); });
  });
}

function handleImageFileForAdd(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    currentImagesData.push({ data: ev.target.result, name: file.name || '', size: file.size || 0, type: file.type });
    showImagePreview();
  };
  reader.readAsDataURL(file);
}
function showImagePreview() {
  const preview = document.getElementById('imagePreview');
  if (!preview) return;
  preview.innerHTML = '';
  if (!currentImagesData.length) return;
  currentImagesData.forEach((imgObj, idx) => {
    const div = document.createElement('div'); div.className='image-item';
    const img = document.createElement('img'); img.src = imgObj.data; img.alt = imgObj.name || `img${idx}`;
    div.appendChild(img);
    const btn = document.createElement('button'); btn.className='remove'; btn.textContent='X'; btn.title='Xóa ảnh';
    btn.addEventListener('click', ()=> { currentImagesData.splice(idx,1); showImagePreview(); });
    div.appendChild(btn);
    preview.appendChild(div);
  });
}

/* Paste on main document: add to Add-form only when edit modal is closed */
document.addEventListener('paste', function(e) {
  if (!e.clipboardData) return;
  const editModalEl = document.getElementById('editModal');
  if (editModalEl && editModalEl.style.display === 'flex') return; // let modal handle paste
  const items = e.clipboardData.items;
  for (let i=0;i<items.length;i++) {
    const item = items[i];
    if (item.type && item.type.indexOf('image') !== -1) {
      const file = item.getAsFile();
      handleImageFileForAdd(file);
      e.preventDefault();
    }
  }
});

/* Add / reset actions */
const clearImagesBtn = document.getElementById('clearImagesBtn');
if (clearImagesBtn) clearImagesBtn.addEventListener('click', ()=> { currentImagesData = []; showImagePreview(); });
const resetFormBtn = document.getElementById('resetFormBtn');
if (resetFormBtn) resetFormBtn.addEventListener('click', resetForm);
function resetForm() {
  const ids = ['title','reason','emailTitle','content'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value=''; });
  currentImagesData = []; showImagePreview();
  const addBtn = document.getElementById('addBtn'); if (addBtn) addBtn.disabled = true;
}

/* Add note */
const addBtnEl = document.getElementById('addBtn');
if (addBtnEl) {
  addBtnEl.addEventListener('click', addNote);
}
function addNote() {
  if (!db) return showNotification('CSDL chưa sẵn sàng', true);
  const title = (document.getElementById('title')||{}).value.trim();
  const reason = (document.getElementById('reason')||{}).value.trim();
  const emailTitle = (document.getElementById('emailTitle')||{}).value.trim();
  const content = (document.getElementById('content')||{}).value.trim();
  if (!title || !reason || !content) return showNotification('Vui lòng nhập: tiêu đề, nguyên nhân và nội dung', true);
  const images = currentImagesData.map(i=>i.data);
  const timestamp = new Date().toISOString();

  const tx = db.transaction('notes','readwrite');
  tx.objectStore('notes').add({ title, reason, emailTitle, content, timestamp, images });
  tx.oncomplete = ()=> { resetForm(); currentPage=1; displayNotes(); updateNotesStats(); showNotification('Đã thêm ghi chú'); };
  tx.onerror = e => { console.error(e); showNotification('Lỗi khi lưu', true); };
}

/* enable add button when fields filled */
['title','reason','content'].forEach(id=>{
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', ()=> {
    const ok = (document.getElementById('title')||{}).value.trim() && (document.getElementById('reason')||{}).value.trim() && (document.getElementById('content')||{}).value.trim();
    const addBtn = document.getElementById('addBtn'); if (addBtn) addBtn.disabled = !ok;
  });
});

/* ----------------- Search / Filter / Display ----------------- */
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
let searchTimer = null;
if (searchInput) {
  searchInput.addEventListener('input', ()=> {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(()=> {
      currentSearch = searchInput.value.trim().toLowerCase();
      currentPage = 1; displayNotes();
    }, 200);
  });
}
if (clearSearchBtn) clearSearchBtn.addEventListener('click', ()=> { if (searchInput) searchInput.value=''; currentSearch=''; currentPage=1; displayNotes(); });

const filterBtn = document.getElementById('filterBtn');
if (filterBtn) filterBtn.addEventListener('click', ()=> {
  const start = (document.getElementById('filterStart')||{}).value;
  const end = (document.getElementById('filterEnd')||{}).value;
  const startISO = start ? new Date(start + 'T00:00:00').toISOString() : null;
  const endISO = end ? new Date(end + 'T23:59:59').toISOString() : null;
  currentFilter = { start: startISO, end: endISO };
  currentPage = 1; displayNotes(); updateNotesStats();
});
const resetFilterBtn = document.getElementById('resetFilterBtn');
if (resetFilterBtn) resetFilterBtn.addEventListener('click', ()=> {
  if (document.getElementById('filterStart')) document.getElementById('filterStart').value='';
  if (document.getElementById('filterEnd')) document.getElementById('filterEnd').value='';
  currentFilter = { start: null, end: null };
  currentPage=1; displayNotes(); updateNotesStats();
});

/* displayNotes */
function displayNotes() {
  if (!db) return;
  const tx = db.transaction('notes','readonly');
  tx.objectStore('notes').getAll().onsuccess = function(e) {
    let notes = e.target.result || [];
    // date filter
    if (currentFilter.start || currentFilter.end) {
      notes = notes.filter(n => {
        if (!n.timestamp) return false;
        if (currentFilter.start && n.timestamp < currentFilter.start) return false;
        if (currentFilter.end && n.timestamp > currentFilter.end) return false;
        return true;
      });
    }
    // search
    if (currentSearch) {
      const q = currentSearch;
      notes = notes.filter(n=>{
        const fields = [
          n.title||'', n.reason||'', n.emailTitle||'', n.content||'', new Date(n.timestamp||'').toLocaleString('vi-VN')
        ].join(' ').toLowerCase();
        return fields.indexOf(q) !== -1;
      });
    }
    // sort newest first
    notes.sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp));
    // pagination
    const total = notes.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * perPage;
    const pageNotes = notes.slice(start, start + perPage);
    renderNotes(pageNotes, total, totalPages);
  };
}

/* renderNotes */
function renderNotes(notesToShow, totalItems, totalPages) {
  const notesDiv = document.getElementById('notes'); if (!notesDiv) return;
  notesDiv.innerHTML = '';
  if (!notesToShow || notesToShow.length === 0) {
    notesDiv.innerHTML = '<div class="small-muted">Không có ghi chú nào.</div>';
  } else {
    notesToShow.forEach(note => {
      const div = document.createElement('div'); div.className='note';
      // checkbox
      const cbWrap = document.createElement('div');
      const checkbox = document.createElement('input'); checkbox.type='checkbox'; checkbox.style.transform='scale(1.2)';
      checkbox.dataset.id = note.id; checkbox.checked = selectedNotes.has(note.id);
      checkbox.onchange = function(){ if(this.checked) selectedNotes.add(note.id); else selectedNotes.delete(note.id); updateBulkActionsVisibility(); };
      cbWrap.appendChild(checkbox);

      // meta
      const meta = document.createElement('div'); meta.className='meta';
      const titleEl = document.createElement('div'); titleEl.innerHTML = `<strong>${escapeHtml(note.title)}</strong>`;
      const timeEl = document.createElement('div'); timeEl.className='small-muted'; timeEl.textContent = new Date(note.timestamp).toLocaleString();
      const causeEl = document.createElement('div'); causeEl.style.marginTop='6px';
      causeEl.innerHTML = `<span style="font-weight:600;">Nguyên nhân:</span> ${escapeHtml(note.reason)}`;
      meta.appendChild(titleEl); meta.appendChild(timeEl); meta.appendChild(causeEl);
      if (note.emailTitle) { const e = document.createElement('div'); e.style.marginTop='6px'; e.innerHTML = `<span style="font-weight:600;">Tiêu đề email:</span> ${escapeHtml(note.emailTitle)}`; meta.appendChild(e); }

      // body
      const body = document.createElement('div'); body.className='body';
      const contentDiv = document.createElement('div'); contentDiv.innerHTML = escapeHtml(note.content);
      body.appendChild(contentDiv);

      const imagesWrap = document.createElement('div'); imagesWrap.className='note-images'; imagesWrap.style.marginTop='8px';
      (note.images||[]).forEach((img, i) => {
        const imgEl = document.createElement('img'); imgEl.src = img; imgEl.dataset.noteid = note.id; imgEl.dataset.idx = i;
        imgEl.title = 'Click để xem phóng to';
        imgEl.addEventListener('click', ()=> openModalFromNoteById(note.id, parseInt(imgEl.dataset.idx)));
        imagesWrap.appendChild(imgEl);
      });
      body.appendChild(imagesWrap);

      const actionsDiv = document.createElement('div'); actionsDiv.className='note-actions';
      const btnEdit = document.createElement('button'); btnEdit.className='btn'; btnEdit.textContent='Cập nhật'; btnEdit.onclick = ()=> openEditModalById(note.id);
      const btnDup = document.createElement('button'); btnDup.className='btn secondary'; btnDup.textContent='Nhân bản'; btnDup.onclick = ()=> duplicateNote(note.id);
      const btnDelete = document.createElement('button'); btnDelete.className='btn danger'; btnDelete.textContent='Xóa'; btnDelete.onclick = ()=> deleteNote(note.id);
      actionsDiv.appendChild(btnEdit); actionsDiv.appendChild(btnDup); actionsDiv.appendChild(btnDelete);
      body.appendChild(actionsDiv);

      div.appendChild(cbWrap); div.appendChild(meta); div.appendChild(body);
      notesDiv.appendChild(div);
    });
  }
  renderPagination(totalPages);
  updateBulkActionsVisibility();
}

/* renderPagination */
function renderPagination(totalPages) {
  const wrap = document.getElementById('pagination'); if (!wrap) return;
  wrap.innerHTML = '';
  if (totalPages <= 1) return;
  const createBtn = (label, disabled, onClick, isActive=false) => {
    const b = document.createElement('button'); b.className='btn'; b.textContent = label; b.disabled = !!disabled; b.onclick = onClick;
    if (isActive) { b.style.background='#2e7d32'; b.style.color='#fff'; }
    return b;
  };
  wrap.appendChild(createBtn('‹', currentPage===1, ()=>{ currentPage--; displayNotes(); }));
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  if (start > 1) { wrap.appendChild(createBtn('1', false, ()=>{ currentPage=1; displayNotes(); })); if (start > 2) { const span = document.createElement('span'); span.textContent='...'; span.style.padding='6px'; wrap.appendChild(span); } }
  for (let i=start;i<=end;i++){ wrap.appendChild(createBtn(String(i), false, ()=>{ currentPage=i; displayNotes(); }, i===currentPage)); }
  if (end < totalPages) { if (end < totalPages - 1) { const span = document.createElement('span'); span.textContent='...'; span.style.padding='6px'; wrap.appendChild(span); } wrap.appendChild(createBtn(String(totalPages), false, ()=>{ currentPage=totalPages; displayNotes(); })); }
  wrap.appendChild(createBtn('›', currentPage===totalPages, ()=>{ currentPage++; displayNotes(); }));
}

/* Bulk selection & actions */
function updateBulkActionsVisibility() {
  const el = document.getElementById('bulkActions');
  const countEl = document.getElementById('selectedCount');
  if (!el || !countEl) return;
  if (selectedNotes.size > 0) { el.style.display='flex'; countEl.textContent = `${selectedNotes.size} mục đã chọn`; }
  else { el.style.display='none'; countEl.textContent=''; }
}
const selectAllBtn = document.getElementById('selectAllBtn');
if (selectAllBtn) selectAllBtn.addEventListener('click', ()=> {
  const shownCheckboxes = Array.from(document.querySelectorAll('#notes input[type="checkbox"]'));
  const allSelected = shownCheckboxes.every(cb=>cb.checked);
  shownCheckboxes.forEach(cb => { cb.checked = !allSelected; const nid = parseInt(cb.dataset.id); if (!isNaN(nid)) { if (cb.checked) selectedNotes.add(nid); else selectedNotes.delete(nid); } });
  updateBulkActionsVisibility();
});
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', ()=> {
  if (selectedNotes.size === 0) return showNotification('Chưa chọn mục nào', true);
  if (!confirm(`Xóa ${selectedNotes.size} ghi chú đã chọn?`)) return;
  const tx = db.transaction('notes','readwrite'); const store = tx.objectStore('notes');
  selectedNotes.forEach(id => store.delete(id));
  tx.oncomplete = ()=> { selectedNotes.clear(); currentPage=1; displayNotes(); updateNotesStats(); showNotification('Đã xóa các ghi chú đã chọn'); };
});

/* Delete single */
function deleteNote(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa ghi chú này?')) return;
  const tx = db.transaction('notes','readwrite'); tx.objectStore('notes').delete(id);
  tx.oncomplete = ()=> { selectedNotes.delete(id); displayNotes(); updateNotesStats(); showNotification('Đã xóa ghi chú'); };
}

/* Duplicate */
function duplicateNote(id) {
  const tx = db.transaction('notes','readonly'); tx.objectStore('notes').get(id).onsuccess = e => {
    const note = e.target.result; if (!note) return;
    const copy = Object.assign({}, note); delete copy.id; copy.timestamp = new Date().toISOString();
    const tx2 = db.transaction('notes','readwrite'); tx2.objectStore('notes').add(copy);
    tx2.oncomplete = ()=> { displayNotes(); updateNotesStats(); showNotification('Đã nhân bản ghi chú'); };
  };
}

/* Stats */
function updateNotesStats() {
  if (!db) return;
  const tx = db.transaction('notes','readonly'); tx.objectStore('notes').getAll().onsuccess = e => {
    const notes = e.target.result || []; const totalImages = notes.reduce((s,n)=> s + (n.images ? n.images.length : 0), 0);
    const el = document.getElementById('notesStats'); if (el) el.innerHTML = `Tổng: ${notes.length} ghi chú • ${totalImages} ảnh`;
  };
}

/* Export Excel */
const exportExcelBtn = document.getElementById('exportExcelBtn');
if (exportExcelBtn) exportExcelBtn.addEventListener('click', ()=> {
  const tx = db.transaction('notes','readonly'); tx.objectStore('notes').getAll().onsuccess = e => {
    const notes = e.target.result || []; if (!notes.length) return showNotification('Không có dữ liệu để xuất', true);
    const data = [['STT','Tiêu đề','Nguyên nhân','Tiêu đề Email','Nội dung','Thời gian','Số ảnh']];
    notes.forEach((n,i)=> data.push([i+1, n.title||'', n.reason||'', n.emailTitle||'', n.content||'', new Date(n.timestamp).toLocaleString('vi-VN'), n.images ? n.images.length : 0]));
    const ws = XLSX.utils.aoa_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Ghi chú");
    const filename = `WEEKLY_REPORT_PHILIPS_W.xlsx`; XLSX.writeFile(wb, filename); showNotification('Đã xuất Excel: ' + filename);
  };
});

/* Export PPTX (KEEP aspect ratio) */
/* utility: load image and return natural width/height (promise) */
function loadImageSize(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}

/* Compute target w/h (in inches for PptxGenJS) preserving aspect ratio.
   assume slide area width ~ 10 (16:9 layout internal width ~ 10 inches normally). */
function fitImageToBox(imgWpx, imgHpx, boxWIn, boxHIn, pxPerIn=96) {
  // Convert px -> inches (approx)
  const imgWIn = imgWpx / pxPerIn;
  const imgHIn = imgHpx / pxPerIn;
  const ratio = Math.min(boxWIn / imgWIn, boxHIn / imgHIn, 1); // don't scale up beyond 1
  return { w: imgWIn * ratio, h: imgHIn * ratio };
}

const exportPptBtn = document.getElementById('exportPptBtn');
if (exportPptBtn) exportPptBtn.addEventListener('click', exportToPptx);

async function exportToPptx() {
  if (!db) return showNotification('CSDL chưa sẵn sàng', true);
  const tx = db.transaction('notes','readonly');
  const req = tx.objectStore('notes').getAll();
  req.onsuccess = async (e) => {
    const notes = e.target.result || [];
    if (!notes.length) return showNotification('Không có dữ liệu để xuất', true);
    try {
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';

      // Title slide
      const s0 = pptx.addSlide();
      s0.addText('Báo cáo Ghi chú', { x:1, y:1.5, w:8, h:1, fontSize:28, bold:true });
      s0.addText(`Ngày: ${new Date().toLocaleDateString('vi-VN')}`, { x:1, y:2.5, w:8, h:0.5, fontSize:12 });

      // For each note, create slide. We'll await image size loads so images inserted with correct w/h.
      // Choose a content area width/height (in inches). We'll place images below text.
      const contentAreaWidth = 9.0; // inches used for text area width
      const contentStartX = 0.5;
      for (const [idx, n] of notes.slice().reverse().entries()) {
        const slide = pptx.addSlide();
        slide.addText(`${idx+1}. ${n.title}`, { x:0.5, y:0.3, w:9, h:0.6, fontSize:18, bold:true });
        slide.addText(`${new Date(n.timestamp).toLocaleString('vi-VN')}`, { x:0.5, y:0.9, w:9, h:0.3, fontSize:10 });
        slide.addText(`Nguyên nhân: ${truncateText(n.reason,180)}`, { x:0.5, y:1.3, w:9, h:0.4, fontSize:12, bold:true });
        slide.addText('Nội dung:', { x:0.5, y:1.7, w:9, h:0.25, fontSize:12, bold:true });
        const contentHeight = Math.max(0.6, Math.ceil((n.content||'').length / 120) * 0.25);
        slide.addText(truncateText(n.content || '', 800), { x:0.5, y:2.0, w:9, h:contentHeight, fontSize:11, valign:'top' });

        if (n.images && n.images.length > 0) {
          // Prepare to place images below text. We'll give a max area per image block.
          // Set max width for one image row (inches) and max height for each image cell
          const maxRowWidth = 9.0; // inches (content area)
          const maxImageHeight = 2.5; // inches max per image row
          const spacing = 0.15; // inch gap between images

          // compute layout: put up to 3 per row (like before), but each image will be scaled to keep ratio.
          const maxPerRow = 3;
          const imgCellMaxW = (maxRowWidth - (maxPerRow - 1) * spacing) / maxPerRow;

          // y start for images:
          let y = 2.0 + contentHeight + 0.2;

          // For each image, load natural px size, compute target w/h in inches, and place.
          for (let iImg = 0; iImg < n.images.length; iImg++) {
            const imgData = n.images[iImg];
            // load size
            let size;
            try {
              size = await loadImageSize(imgData);
            } catch (err) {
              console.warn('Không lấy được kích thước ảnh, bỏ qua', err);
              continue;
            }
            // compute target size for cell
            const col = iImg % maxPerRow;
            const row = Math.floor(iImg / maxPerRow);
            // compute x for this column
            const x = contentStartX + col * (imgCellMaxW + spacing);

            // For vertical placement, if moving to new row compute y
            if (col === 0 && iImg !== 0) {
              // new row
              y += maxImageHeight + spacing;
            }

            // Fit image into cell (imgCellMaxW x maxImageHeight) preserving aspect ratio
            const fitted = fitImageToBox(size.w, size.h, imgCellMaxW, maxImageHeight, 96);
            // Center image in its cell horizontally/vertically
            const offsetX = x + (imgCellMaxW - fitted.w) / 2;
            const offsetY = y + (maxImageHeight - fitted.h) / 2;

            try {
              slide.addImage({ data: imgData, x: offsetX, y: offsetY, w: fitted.w, h: fitted.h });
            } catch (err) {
              console.warn('Không chèn được ảnh vào slide', err);
            }
          }
        }
      }

      const fileName = `NOTE_REPORT_W.pptx`;
      await pptx.writeFile({ fileName });
      showNotification('Đã xuất PowerPoint: ' + fileName);
    } catch (err) {
      console.error(err);
      showNotification('Lỗi khi xuất PowerPoint', true);
    }
  };
}

/* utility truncate */
function truncateText(text, maxChars) { if (!text) return ''; return text.length > maxChars ? text.slice(0, maxChars-3) + '...' : text; }

/* ----------------- Image modal (view) ----------------- */
let modalImages = [], modalIndex = 0;
const imageModal = document.getElementById('imageModal');
const imageModalContent = document.getElementById('imageModalContent');

function openModalFromNoteById(noteId, startIndex=0) {
  if (!db) return;
  const tx = db.transaction('notes','readonly'); tx.objectStore('notes').get(noteId).onsuccess = e => {
    const note = e.target.result; if (!note || !note.images || note.images.length===0) return;
    modalImages = note.images.slice(); modalIndex = startIndex; updateModalImage();
    // show modal
    if (imageModal) { imageModal.style.display = 'flex'; imageModal.setAttribute('aria-hidden','false'); }
    // focus for keyboard accessibility (optional)
    if (imageModalContent) imageModalContent.focus();
  };
}
function updateModalImage() {
  if (!modalImages || modalImages.length===0) return;
  const modalImg = document.getElementById('modalImage');
  if (modalImg) modalImg.src = modalImages[modalIndex];
  const counter = document.getElementById('modalCounter');
  if (counter) counter.textContent = `${modalIndex+1} / ${modalImages.length}`;
}
const modalPrevBtn = document.getElementById('modalPrevBtn');
if (modalPrevBtn) modalPrevBtn.addEventListener('click', ()=> { if (!modalImages.length) return; modalIndex = (modalIndex - 1 + modalImages.length) % modalImages.length; updateModalImage(); });
const modalNextBtn = document.getElementById('modalNextBtn');
if (modalNextBtn) modalNextBtn.addEventListener('click', ()=> { if (!modalImages.length) return; modalIndex = (modalIndex + 1) % modalImages.length; updateModalImage(); });

// modalCloseBtn if exists
const modalCloseBtn = document.getElementById('modalCloseBtn');
if (modalCloseBtn) modalCloseBtn.addEventListener('click', ()=> { if (imageModal) { imageModal.style.display='none'; imageModal.setAttribute('aria-hidden','true'); } });

// IMPORTANT: do NOT close image modal by overlay click or Escape (to avoid accidental close)

/* ----------------- Edit modal (isolate changes until save) ----------------- */
const editModal = document.getElementById('editModal');
const editModalContent = document.getElementById('editModalContent');
const editImageInput = document.getElementById('editImageInput');

function openEditModalById(id) {
  if (!db) return;
  const tx = db.transaction('notes','readonly');
  tx.objectStore('notes').get(id).onsuccess = e => {
    const note = e.target.result;
    if (!note) return;
    editingId = id;
    // fill fields
    const ids = ['editTitle','editReason','editEmailTitle','editContent'];
    if (document.getElementById('editTitle')) document.getElementById('editTitle').value = note.title || '';
    if (document.getElementById('editReason')) document.getElementById('editReason').value = note.reason || '';
    if (document.getElementById('editEmailTitle')) document.getElementById('editEmailTitle').value = note.emailTitle || '';
    if (document.getElementById('editContent')) document.getElementById('editContent').value = note.content || '';
    // copy images (do NOT mutate original)
    editExistingImages = (note.images || []).slice();
    editNewImages = [];
    renderEditExistingImages();
    renderEditNewPreview();
    // show modal
    if (editModal) { editModal.style.display = 'flex'; editModal.setAttribute('aria-hidden','false'); }
    if (editModalContent) editModalContent.focus();
  };
}

function renderEditExistingImages() {
  const wrap = document.getElementById('editExistingImages');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!editExistingImages || !editExistingImages.length) { wrap.innerHTML = '<div class="small-muted">Không còn ảnh</div>'; return; }
  editExistingImages.forEach((data, idx) => {
    const div = document.createElement('div'); div.className='image-item';
    const img = document.createElement('img'); img.src = data; img.alt = `img${idx}`; div.appendChild(img);
    const btn = document.createElement('button'); btn.className='remove'; btn.textContent='X'; btn.title='Xóa ảnh';
    btn.addEventListener('click', ()=> { editExistingImages.splice(idx,1); renderEditExistingImages(); });
    div.appendChild(btn);
    wrap.appendChild(div);
  });
}

if (editImageInput) {
  editImageInput.addEventListener('change', function() {
    const files = Array.from(this.files || []);
    files.forEach(f => {
      if (!f.type.startsWith('image/')) return;
      const r = new FileReader();
      r.onload = ev => { editNewImages.push(ev.target.result); renderEditNewPreview(); };
      r.readAsDataURL(f);
    });
    this.value = '';
  });
}

function renderEditNewPreview() {
  const wrap = document.getElementById('editNewPreview');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!editNewImages.length) { wrap.innerHTML = '<div class="small-muted">Chưa có ảnh mới</div>'; return; }
  editNewImages.forEach((data, idx) => {
    const div = document.createElement('div'); div.className='image-item';
    const img = document.createElement('img'); img.src = data; img.alt = `new${idx}`; div.appendChild(img);
    const btn = document.createElement('button'); btn.className='remove'; btn.textContent='X'; btn.title='Xóa ảnh';
    btn.addEventListener('click', ()=> { editNewImages.splice(idx,1); renderEditNewPreview(); });
    div.appendChild(btn);
    wrap.appendChild(div);
  });
}

/* Paste handler for edit modal only */
if (editModalContent) {
  editModalContent.addEventListener('paste', function(e) {
    if (!e.clipboardData) return;
    const items = e.clipboardData.items;
    let found = false;
    for (let i=0;i<items.length;i++) {
      const item = items[i];
      if (item.type && item.type.indexOf('image') !== -1) {
        found = true;
        const file = item.getAsFile();
        const r = new FileReader();
        r.onload = ev => { editNewImages.push(ev.target.result); renderEditNewPreview(); };
        r.readAsDataURL(file);
      }
    }
    if (found) e.preventDefault();
  });
}

/* Close behavior for edit modal: ONLY by Cancel or X -- NOT by overlay click */
// Cancel button
const cancelEditBtn = document.getElementById('cancelEditBtn');
if (cancelEditBtn) cancelEditBtn.addEventListener('click', ()=> {
  editingId = null;
  editExistingImages = [];
  editNewImages = [];
  if (editModal) { editModal.style.display = 'none'; editModal.setAttribute('aria-hidden','true'); }
});
// X button (optional)
const editModalCloseBtn = document.getElementById('editModalCloseBtn');
if (editModalCloseBtn) editModalCloseBtn.addEventListener('click', ()=> {
  editingId = null;
  editExistingImages = [];
  editNewImages = [];
  if (editModal) { editModal.style.display = 'none'; editModal.setAttribute('aria-hidden','true'); }
});

// Prevent overlay click from closing edit modal: override click and do nothing
if (editModal) {
  editModal.addEventListener('click', (e)=> {
    // do nothing even if overlay clicked
  });
}

/* Save edit */
const saveEditBtn = document.getElementById('saveEditBtn');
if (saveEditBtn) saveEditBtn.addEventListener('click', function() {
  if (!editingId) return showNotification('Không có ghi chú để cập nhật', true);
  const title = (document.getElementById('editTitle')||{}).value.trim();
  const reason = (document.getElementById('editReason')||{}).value.trim();
  const emailTitle = (document.getElementById('editEmailTitle')||{}).value.trim();
  const content = (document.getElementById('editContent')||{}).value.trim();
  if (!title || !reason || !content) return showNotification('Vui lòng nhập đầy đủ: tiêu đề, nguyên nhân, nội dung', true);

  const tx = db.transaction('notes','readwrite');
  const store = tx.objectStore('notes');
  const getReq = store.get(editingId);
  getReq.onsuccess = function(e) {
    const note = e.target.result;
    if (!note) return showNotification('Không tìm thấy ghi chú', true);
    note.title = title;
    note.reason = reason;
    note.emailTitle = emailTitle;
    note.content = content;
    // final images = existing kept + new images
    note.images = (editExistingImages || []).concat(editNewImages || []);
    store.put(note);
  };
  tx.oncomplete = () => {
    editingId = null; editExistingImages = []; editNewImages = [];
    if (editModal) { editModal.style.display = 'none'; editModal.setAttribute('aria-hidden','true'); }
    displayNotes(); updateNotesStats(); showNotification('Đã cập nhật ghi chú');
  };
  tx.onerror = (e)=> { console.error(e); showNotification('Lỗi khi cập nhật', true); };
});

/* ----------------- Reset DB modal actions ----------------- */
const refreshDbBtn = document.getElementById('refreshDbBtn');
if (refreshDbBtn) refreshDbBtn.addEventListener('click', ()=> {
  const m = document.getElementById('confirmResetModal');
  if (m) { m.style.display = 'flex'; m.setAttribute('aria-hidden','false'); }
});
const cancelResetBtn = document.getElementById('cancelResetBtn');
if (cancelResetBtn) cancelResetBtn.addEventListener('click', ()=> {
  const m = document.getElementById('confirmResetModal');
  if (m) { m.style.display = 'none'; m.setAttribute('aria-hidden','true'); }
});
const confirmResetBtn = document.getElementById('confirmResetBtn');
if (confirmResetBtn) confirmResetBtn.addEventListener('click', ()=> {
  const tx = db.transaction('notes','readwrite'); tx.objectStore('notes').clear();
  tx.oncomplete = ()=> {
    const m = document.getElementById('confirmResetModal');
    if (m) { m.style.display = 'none'; m.setAttribute('aria-hidden','true'); }
    currentPage = 1; selectedNotes.clear(); displayNotes(); updateNotesStats(); showNotification('Đã xóa toàn bộ dữ liệu');
  };
  tx.onerror = e => { console.error(e); showNotification('Lỗi khi xóa dữ liệu', true); };
});

/* Expose some functions for inline buttons */
window.openEditModal = openEditModalById;
window.deleteNote = deleteNote;
window.duplicateNote = duplicateNote;
window.openModalFromNoteById = openModalFromNoteById;

