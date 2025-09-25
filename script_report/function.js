
/* Time display */


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

  if (!title || !reason || !content)
    return showNotification('Vui lòng nhập: tiêu đề, nguyên nhân và nội dung', true);

  const images = currentImagesData.map(i => i.data);
  const timestamp = new Date().toISOString();

  // 1️⃣ Lưu vào IndexedDB
  const tx = db.transaction('notes','readwrite');
  tx.objectStore('notes').add({ title, reason, emailTitle, content, timestamp, images });
  tx.oncomplete = () => {
    resetForm();
    currentPage = 1;
    displayNotes();
    updateNotesStats();
    showNotification('Đã thêm ghi chú thành công');

    // 2️⃣ Đồng thời gửi lên Google Sheet
    const formData = new FormData();
    formData.append('title', title);
    formData.append('reason', reason);
    formData.append('emailTitle', emailTitle);
    formData.append('content', content);
    formData.append('timestamp', timestamp);
    if (images.length) formData.append('images', images.join('\n')); // join thành chuỗi

    fetch(scriptURL, { method: 'POST', body: formData })
      .then(res => {
        if (!res.ok) throw new Error('Lỗi gửi dữ liệu lên Sheet: ' + res.status);
        return res.json();
      })
      .then(data => {
        // showNotification('Đã gửi dữ liệu lên Google Sheet thành công!');
      })
      .catch(err => {
        console.error(err);
        showNotification('Lỗi khi gửi dữ liệu lên Sheet: ' + err.message, true);
      });
  };

  tx.onerror = e => {
    console.error(e);
    showNotification('Lỗi khi lưu vào IndexedDB', true);
  };
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