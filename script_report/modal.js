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