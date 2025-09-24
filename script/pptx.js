function exportToPptx() {
    if (!filteredData || filteredData.length <= 1) {
        showNotification("Không có dữ liệu để xuất PowerPoint!", true);
        return;
    }

    if (typeof PptxGenJS === 'undefined') {
        showNotification("Thư viện PowerPoint chưa được tải. Vui lòng thử lại sau 5 giây!", true);
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
        script.onload = () => showNotification("Thư viện đã tải xong, hãy thử lại!");
        document.head.appendChild(script);
        return;
    }

    try {
        showNotification("Đang tạo file PowerPoint...");

        const pptx = new PptxGenJS();
        pptx.author = 'Hệ thống Quản lý Lỗi';
        pptx.company = 'Note Report System';
        pptx.title = 'Note Report';
        pptx.layout = 'LAYOUT_16x9';

        // Slide đầu
        const titleSlide = pptx.addSlide();
        titleSlide.background = { color: 'F1F8E9' };
        titleSlide.addText('Note Report', {
            x: 0.7, y: 1.8, w: 8.6, h: 1.2,
            fontSize: 44, bold: true, fontFace: 'Arial', color: '2E7D32', align: 'center'
        });
        titleSlide.addText('Báo cáo tổng hợp các lỗi hệ thống', {
            x: 0.7, y: 3.3, w: 8.6, h: 0.7,
            fontSize: 19, fontFace: 'Arial', color: '424242', align: 'center'
        });

        const currentDate = new Date().toLocaleDateString('vi-VN', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        titleSlide.addText(`Ngày tạo: ${currentDate}`, {
            x: 0.7, y: 4.3, w: 8.6, h: 0.5,
            fontSize: 13, fontFace: 'Arial', color: '757575', align: 'center'
        });
        titleSlide.addText(`Tổng số lỗi: ${filteredData.length - 1} record(s)`, {
            x: 0.7, y: 5.0, w: 8.6, h: 0.5,
            fontSize: 13, fontFace: 'Arial', color: '757575', align: 'center'
        });

        const dataRows = filteredData.slice(1);

        dataRows.forEach((row, index) => {
            const slide = pptx.addSlide();
            slide.background = { color: 'FAFAFA' };

            slide.addText(`Lỗi #${index + 1}: ${row[0] || 'N/A'}`, {
                x: 0.7, y: 0.4, w: 8.6, h: 0.7,
                fontSize: 22, bold: true, fontFace: 'Arial', color: '1976D2', align: 'left'
            });

            slide.addText('', {
                x: 0.7, y: 1.1, w: 8.6, h: 0.02,
                fill: { color: 'E0E0E0' }
            });

            let yPos = 1.4;

            // Mô tả lỗi
            if (row[1]) {
                slide.addText('Mô tả lỗi:', {
                    x: 0.7, y: yPos, w: 2, h: 0.4,
                    fontSize: 13, bold: true, color: '424242'
                });
                slide.addText(row[1].toString(), {
                    x: 2.9, y: yPos, w: 6.4, h: 0.4,
                    fontSize: 12, color: '555555'
                });
                yPos += 0.6;
            }

            // Tiêu đề mail
            if (row[2]) {
                slide.addText('Tiêu đề mail:', {
                    x: 0.7, y: yPos, w: 2, h: 0.4,
                    fontSize: 13, bold: true, color: '424242'
                });
                slide.addText(row[2].toString(), {
                    x: 2.9, y: yPos, w: 6.4, h: 0.4,
                    fontSize: 12, color: '555555'
                });
                yPos += 0.6;
            }

            // Vấn đề lỗi
            if (row[3]) {
                slide.addText('Vấn đề lỗi:', {
                    x: 0.7, y: yPos, w: 2, h: 0.4,
                    fontSize: 13, bold: true, color: '424242'
                });
                const problemText = row[3].toString();
                const problemHeight = Math.max(0.8, Math.ceil(problemText.length / 70) * 0.35);
                slide.addText(problemText, {
                    x: 2.9, y: yPos, w: 6.4, h: problemHeight,
                    fontSize: 12, color: '555555', valign: 'top'
                });
                yPos += problemHeight + 0.2;
            }

            // Cách fix
            if (row[4]) {
                slide.addText('Cách fix:', {
                    x: 0.7, y: yPos, w: 2, h: 0.4,
                    fontSize: 13, bold: true, color: '424242'
                });
                const solutionText = row[4].toString();
                const solutionHeight = Math.max(0.8, Math.ceil(solutionText.length / 70) * 0.35);
                slide.addText(solutionText, {
                    x: 2.9, y: yPos, w: 6.4, h: solutionHeight,
                    fontSize: 12, color: '555555', valign: 'top'
                });
                yPos += solutionHeight + 0.2;
            }

            // Thời gian
            if (row[5]) {
                slide.addText('Thời gian:', {
                    x: 0.7, y: yPos, w: 2, h: 0.4,
                    fontSize: 13, bold: true, color: '424242'
                });
                slide.addText(formatDateTime(row[5]), {
                    x: 2.9, y: yPos, w: 6.4, h: 0.4,
                    fontSize: 12, color: '555555'
                });
                yPos += 0.6;
            }

            // Link ảnh
            if (row[6] && row[6].toString().trim()) {
                slide.addText('Link ảnh:', {
                    x: 0.7, y: yPos, w: 2, h: 0.4,
                    fontSize: 13, bold: true, color: '424242'
                });
                const imageLinks = row[6].toString().split(/\r?\n|,|;/)
                    .map(l => l.trim()).filter(l => l).slice(0, 3);
                imageLinks.forEach((link, linkIndex) => {
                    slide.addText(link, {
                        x: 2.9, y: yPos + (linkIndex * 0.3),
                        w: 6.4, h: 0.3,
                        fontSize: 10, color: '1976D2', hyperlink: { url: link }
                    });
                });
                yPos += (imageLinks.length * 0.3) + 0.3;
            }

            slide.addText(`${index + 2} / ${dataRows.length + 1}`, {
                x: 8.6, y: 6.8, w: 0.8, h: 0.3,
                fontSize: 10, color: '999999', align: 'center'
            });
        });

        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const fileName = `Note_Report_${timestamp}.pptx`;

        pptx.writeFile({ fileName }).then(() => {
            showNotification(`Đã xuất thành công file ${fileName}!`);
        }).catch((error) => {
            console.error('Lỗi khi xuất PPTX:', error);
            showNotification('Có lỗi xảy ra khi xuất PowerPoint: ' + error.message, true);
        });

    } catch (error) {
        console.error('Lỗi khi tạo PPTX:', error);
        showNotification('Có lỗi xảy ra khi tạo PowerPoint: ' + error.message, true);
    }
}
