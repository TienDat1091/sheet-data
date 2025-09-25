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
