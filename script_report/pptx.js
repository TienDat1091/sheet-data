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
      s0.addText('Note Report W', { x:1, y:1.5, w:8, h:1, fontSize:54, align:'center' });
      // s0.addText(`Ngày: ${new Date().toLocaleDateString('vi-VN')}`, { x:1, y:2.5, w:8, h:0.5, fontSize:12 });

      // For each note, create slide. We'll await image size loads so images inserted with correct w/h.
      // Choose a content area width/height (in inches). We'll place images below text.
      const contentAreaWidth = 9.0; // inches used for text area width
      const contentStartX = 0.5;
      for (const [idx, n] of notes.slice().reverse().entries()) {
        const slide = pptx.addSlide();
        slide.addText(`${idx + 1}. ${n.title}`, {x:0.5,y:0.3,w:9,h:0.6,fontSize:18,bold:true}); 
        slide.addText(`Subject: ${truncateText(n.emailTitle,180)}`, {x:0.5,y:1.0,w:9,h:0.4,fontSize:12,bold:true});
        slide.addText(`Why: ${truncateText(n.reason,180)}`, {x:0.5,y:1.5,w:9,h:0.4,fontSize:12,bold:true}); 
        slide.addText('How:', {x:0.5,y:2.0,w:9,h:0.25,fontSize:12,bold:true}); 
        const contentHeight = Math.max(0.6,Math.ceil((n.content||'').length/120)*0.25); slide.addText(truncateText(n.content||'',800), {x:0.5,y:2.3,w:9,h:contentHeight,fontSize:11,valign:'top'});

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

      const fileName = `Note Report W.pptx`;
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