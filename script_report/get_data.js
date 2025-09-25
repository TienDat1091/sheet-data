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

function updateCurrentTime() {
  const el = document.getElementById('currentTime');
  if (!el) return;
  function tick() {
    el.textContent = new Date().toLocaleString('vi-VN', { hour12:false });
    setTimeout(tick, 1000);
  }
  tick();
}

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

window.openEditModal = openEditModalById;
window.deleteNote = deleteNote;
window.duplicateNote = duplicateNote;
window.openModalFromNoteById = openModalFromNoteById;

