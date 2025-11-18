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
    let notes = e.target.result || []; // Thay const bằng let
    
    // 🔥 THÊM PHẦN LỌC DỮ LIỆU - giống như trong displayNotes
    // Áp dụng bộ lọc thời gian
    if (currentFilter.start || currentFilter.end) {
      notes = notes.filter(n => {
        if (!n.timestamp) return false;
        if (currentFilter.start && n.timestamp < currentFilter.start) return false;
        if (currentFilter.end && n.timestamp > currentFilter.end) return false;
        return true;
      });
    }
    
    // Áp dụng tìm kiếm
    if (currentSearch) {
      const q = currentSearch;
      notes = notes.filter(n=>{
        const fields = [
          n.title||'', n.reason||'', n.emailTitle||'', n.content||'', new Date(n.timestamp||'').toLocaleString('vi-VN')
        ].join(' ').toLowerCase();
        return fields.indexOf(q) !== -1;
      });
    }
    
    // Sắp xếp mới nhất trước (giống displayNotes)
    notes.sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp));
    
    // 🔥 KIỂM TRA XEM CÓ DỮ LIỆU SAU KHI LỌC KHÔNG
    if (!notes.length) return showNotification('Không có dữ liệu phù hợp để xuất', true);
    
    // Phần còn lại giữ nguyên...
    try {
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';

      // Title slide
      const s0 = pptx.addSlide();
      s0.addText('Note Report W', { x:1, y:1.5, w:8, h:1, fontSize:54, align:'center' });
      
      // 🔥 THÊM THÔNG TIN BỘ LỌC VÀO SLIDE TIÊU ĐỀ
      let filterInfo = '';
      if (currentFilter.start || currentFilter.end) {
        const startStr = currentFilter.start ? new Date(currentFilter.start).toLocaleDateString('vi-VN') : '';
        const endStr = currentFilter.end ? new Date(currentFilter.end).toLocaleDateString('vi-VN') : '';
        filterInfo = ` (Từ ${startStr} đến ${endStr})`;
      }
      if (currentSearch) {
        filterInfo += ` [Tìm: "${currentSearch}"]`;
      }
      
      s0.addText(`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}${filterInfo}`, 
                { x:1, y:2.5, w:8, h:0.5, fontSize:12, align: 'center' });

      // For each note, create slide...
      const contentAreaWidth = 9.0;
      const contentStartX = 0.5;
      for (const [idx, n] of notes.slice().reverse().entries()) {
        const slide = pptx.addSlide();
        slide.addText(`${idx + 1}. ${n.title}`, {x:0.5,y:0.3,w:9,h:0.6,fontSize:18,bold:true}); 
        slide.addText(`Subject: ${truncateText(n.emailTitle,180)}`, {x:0.5,y:1.0,w:9,h:0.4,fontSize:12,bold:true});
        slide.addText(`Why: ${truncateText(n.reason,180)}`, {x:0.5,y:1.5,w:9,h:0.4,fontSize:12,bold:true}); 
        slide.addText('How:', {x:0.5,y:2.0,w:9,h:0.25,fontSize:12,bold:true}); 
        const contentHeight = Math.max(0.6,Math.ceil((n.content||'').length/120)*0.25); 
        slide.addText(truncateText(n.content||'',800), {x:0.5,y:2.3,w:9,h:contentHeight,fontSize:11,valign:'top'});

        if (n.images && n.images.length > 0) {
          const maxRowWidth = 9.0;
          const maxImageHeight = 2.5;
          const spacing = 0.15;
          const maxPerRow = 3;
          const imgCellMaxW = (maxRowWidth - (maxPerRow - 1) * spacing) / maxPerRow;

          let y = 2.0 + contentHeight + 0.2;

          for (let iImg = 0; iImg < n.images.length; iImg++) {
            const imgData = n.images[iImg];
            let size;
            try {
              size = await loadImageSize(imgData);
            } catch (err) {
              console.warn('Không lấy được kích thước ảnh, bỏ qua', err);
              continue;
            }
            
            const col = iImg % maxPerRow;
            const row = Math.floor(iImg / maxPerRow);
            const x = contentStartX + col * (imgCellMaxW + spacing);

            if (col === 0 && iImg !== 0) {
              y += maxImageHeight + spacing;
            }

            const fitted = fitImageToBox(size.w, size.h, imgCellMaxW, maxImageHeight, 96);
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

      const fileName = `Note Report W${currentFilter.start || currentSearch ? ' ()' : ''}.pptx`;
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