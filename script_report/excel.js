/* Export Excel */
const exportExcelBtn = document.getElementById('exportExcelBtn');
if (exportExcelBtn) exportExcelBtn.addEventListener('click', ()=> {
  const tx = db.transaction('notes','readonly'); 
  tx.objectStore('notes').getAll().onsuccess = e => {
    let notes = e.target.result || []; 
    
    // 🔥 ÁP DỤNG BỘ LỌC THỜI GIAN - giống như displayNotes và exportToPptx
    if (currentFilter.start || currentFilter.end) {
      notes = notes.filter(n => {
        if (!n.timestamp) return false;
        if (currentFilter.start && n.timestamp < currentFilter.start) return false;
        if (currentFilter.end && n.timestamp > currentFilter.end) return false;
        return true;
      });
    }
    
    // 🔥 ÁP DỤNG TÌM KIẾM
    if (currentSearch) {
      const q = currentSearch;
      notes = notes.filter(n=>{
        const fields = [
          n.title||'', n.reason||'', n.emailTitle||'', n.content||'', new Date(n.timestamp||'').toLocaleString('vi-VN')
        ].join(' ').toLowerCase();
        return fields.indexOf(q) !== -1;
      });
    }
    
    // 🔥 SẮP XẾP MỚI NHẤT TRƯỚC
    notes.sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp));
    
    if (!notes.length) return showNotification('Không có dữ liệu phù hợp để xuất', true);
    
    const data = [['STT','Tiêu đề','Nguyên nhân','Tiêu đề Email','Nội dung','Thời gian','Số ảnh']];
    notes.forEach((n,i)=> data.push([
      i+1, 
      n.title||'', 
      n.reason||'', 
      n.emailTitle||'', 
      n.content||'', 
      new Date(n.timestamp).toLocaleString('vi-VN'), 
      n.images ? n.images.length : 0
    ]));
    
    const ws = XLSX.utils.aoa_to_sheet(data); 
    const wb = XLSX.utils.book_new(); 
    XLSX.utils.book_append_sheet(wb, ws, "Ghi chú");
    
    // 🔥 THÊM THÔNG TIN BỘ LỌC VÀO TÊN FILE
    let filename = `WEEKLY_REPORT_PHILIPS_W.xlsx`;
    if (currentFilter.start || currentFilter.end || currentSearch) {
      let filterInfo = '';
      if (currentFilter.start || currentFilter.end) {
        const startStr = currentFilter.start ? new Date(currentFilter.start).toLocaleDateString('vi-VN') : '';
        const endStr = currentFilter.end ? new Date(currentFilter.end).toLocaleDateString('vi-VN') : '';
        filterInfo = `_${startStr}_${endStr}`.replace(/\//g, '-');
      }
      if (currentSearch) {
        filterInfo += `_${currentSearch.substring(0, 10)}`;
      }
      filename = `WEEKLY_REPORT_PHILIPS_W${filterInfo}.xlsx`;
    }
    
    XLSX.writeFile(wb, filename); 
    showNotification('Đã xuất Excel: ' + filename);
  };
});