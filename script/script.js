const apiKey = 'AIzaSyBCF4lFlZFecrRPCZPCoPJRaUB3ZPGK2kk';
const spreadsheetId = '18ehCo3v-QeAyjEKump-ZffgsX2d2_Q2bljUaGvJvIK4';
const range = 'sheet1!A1:G';
const scriptURL = 'https://script.google.com/macros/s/AKfycbw3ZbmPghaM5CEg8f2PgXGobBTJkdPadMzExHfhWNtaevNt8W3lxCt81vw2ZDtt_SnJ/exec';

let sheetData = [];
let filteredData = [];
const itemsPerPage = 10;
let currentPage = 1;

// Hiển thị thông báo
function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#f44336' : '#4CAF50';
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

// Loader
function toggleLoader(show) {
    document.getElementById('loader').style.display = show ? 'inline-block' : 'none';
}

// Tạo ID tự động
function generateAutoID(data) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    const todayIDs = data.slice(1)
        .filter(row => row[0] && row[0].startsWith(datePrefix))
        .map(row => row[0]);
    
    let maxSerial = 0;
    todayIDs.forEach(id => {
        const serial = parseInt(id.slice(8), 10);
        if (!isNaN(serial) && serial > maxSerial) maxSerial = serial;
    });

    const nextSerial = String(maxSerial + 1).padStart(3, '0');
    return `${datePrefix}${nextSerial}`;
}

function updateAutoID() {
    const idInput = document.getElementById('id');
    const idPreview = document.getElementById('id-preview');
    const autoID = generateAutoID(sheetData);
    idInput.value = autoID;
    idPreview.textContent = `ID tiếp theo: ${autoID}`;
}

// Đặt thời gian mặc định
function setDefaultTimestamp() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const adjustedDate = new Date(now.getTime() - (offset * 60 * 1000));
    const formattedDate = adjustedDate.toISOString().slice(0, 16);
    document.getElementById('timestamp').value = formattedDate;
}

// Lọc theo thời gian
function filterByDate() {
    const startDateInput = document.getElementById("startDate").value;
    const endDateInput = document.getElementById("endDate").value;

    if (!startDateInput || !endDateInput) {
        showNotification("Vui lòng chọn cả thời gian bắt đầu và kết thúc.", true);
        return;
    }

    const start = new Date(startDateInput);
    const end = new Date(endDateInput);
    end.setSeconds(59);

    filteredData = [sheetData[0], ...sheetData.slice(1).filter(row => {
        if (!row[5]) return false;
        const rowDate = new Date(row[5].toString().replace(" ", "T"));
        return rowDate >= start && rowDate <= end;
    })];

    currentPage = 1;
    displayData(filteredData, currentPage);
}

// Nút làm mới filter
document.getElementById('resetFilterButton').addEventListener('click', () => {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    filteredData = sheetData; // Trả về toàn bộ dữ liệu gốc
    currentPage = 1;
    displayData(filteredData, currentPage);
});


document.getElementById('filterButton').addEventListener('click', filterByDate);
// Tìm kiếm
function searchTable() {
    const input = document.getElementById('searchInput').value.toLowerCase();
    if (!sheetData.length) {
        document.getElementById('error').textContent = 'Chưa có dữ liệu để tìm kiếm.';
        return;
    }

    filteredData = [sheetData[0], ...sheetData.slice(1).filter(row =>
        row.some(cell => cell && cell.toString().toLowerCase().includes(input))
    )];

    currentPage = 1;
    displayData(filteredData, currentPage);
}

// Hiển thị dữ liệu với phân trang
function displayData(data, page = 1) {
    const dataBody = document.getElementById('data');
    const errorDiv = document.getElementById('error');
    const paginationDiv = document.getElementById('pagination');

    dataBody.innerHTML = '';
    errorDiv.textContent = '';
    paginationDiv.innerHTML = '';

    if (!data || data.length <= 1) {
        errorDiv.textContent = 'Không có dữ liệu để hiển thị.';
        return;
    }

    const header = data[0];
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = data.slice(1).slice(startIndex, endIndex);

    if (paginatedData.length === 0) {
        const tr = document.createElement('tr');
        tr.classList.add('no-data-row');
        const td = document.createElement('td');
        td.colSpan = header.length;
        td.textContent = 'Không tìm thấy dữ liệu phù hợp.';
        tr.appendChild(td);
        dataBody.appendChild(tr);
    } else {
        paginatedData.forEach(row => {
            const tr = document.createElement('tr');
            row.forEach((cell, index) => {
                const td = document.createElement('td');

                // Cột link ảnh (index = 6)
                if (index === 6 && cell) {
                    let links = cell.split(/\r?\n|,|;/).map(l => l.trim()).filter(l => l);
                    td.innerHTML = links.map(l => `<img src="${l}" alt="Ảnh minh họa" width="150">`).join('<br>');
                } else {
                    td.textContent = cell || '';
                }

                tr.appendChild(td);
            });
            dataBody.appendChild(tr);
        });
    }

    // Phân trang
    const totalPages = Math.ceil((data.length - 1) / itemsPerPage);
    if (totalPages > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.disabled = page === 1;
        prevButton.addEventListener('click', () => {
            currentPage = Math.max(1, page - 1);
            displayData(data, currentPage);
        });
        paginationDiv.appendChild(prevButton);

        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.className = i === page ? 'active' : '';
            pageButton.addEventListener('click', () => {
                currentPage = i;
                displayData(data, currentPage);
            });
            paginationDiv.appendChild(pageButton);
        }

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.disabled = page === totalPages;
        nextButton.addEventListener('click', () => {
            currentPage = Math.min(totalPages, page + 1);
            displayData(data, currentPage);
        });
        paginationDiv.appendChild(nextButton);
    }

    updateAutoID();
}

// Lấy dữ liệu từ Google Sheet
async function fetchGoogleSheetData() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
    const errorDiv = document.getElementById('error');
    toggleLoader(true);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        sheetData = data.values || [];
        filteredData = sheetData;

        if (sheetData.length === 0) {
            errorDiv.textContent = 'Không có dữ liệu trong Google Sheet.';
            return;
        }

        currentPage = 1;
        displayData(filteredData, currentPage);
    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu:', error);
        errorDiv.textContent = 'Lỗi khi tải dữ liệu từ Google Sheets.';
    } finally {
        toggleLoader(false);
    }
}

// Xuất Excel
function exportToExcel() {
    if (!filteredData || filteredData.length === 0) {
        showNotification("Không có dữ liệu để xuất!", true);
        return;
    }

    const wb = XLSX.utils.book_new();
    const wsData = filteredData.map(row => row.map((cell, index) => {
        if (index === 6 && cell) return cell.replace(/\r?\n/g, '\n');
        return cell;
    }));
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "data.xlsx");
}


// Hàm kiểm tra và format thời gian
function formatDateTime(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        const date = new Date(timestamp.toString().replace(" ", "T"));
        return date.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return timestamp.toString();
    }
}

// Xuất PowerPoint PPTX
function exportToPptx() {
    // Kiểm tra dữ liệu
    if (!filteredData || filteredData.length <= 1) {
        showNotification("Không có dữ liệu để xuất PowerPoint!", true);
        return;
    }

    // Kiểm tra thư viện PptxGenJS
    if (typeof PptxGenJS === 'undefined') {
        showNotification("Thư viện PowerPoint chưa được tải. Vui lòng thử lại sau 5 giây!", true);
        
        // Thử tải lại thư viện
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
        script.onload = () => showNotification("Thư viện đã tải xong, hãy thử lại!");
        document.head.appendChild(script);
        return;
    }

    try {
        showNotification("Đang tạo file PowerPoint...");
        
        // Tạo presentation mới
        const pptx = new PptxGenJS();
        
        // Cấu hình presentation
        pptx.author = 'Hệ thống Quản lý Lỗi';
        pptx.company = 'Note Report System';
        pptx.title = 'Note Report';
        pptx.layout = 'LAYOUT_16x9';

        // Slide đầu tiên - Title slide
        const titleSlide = pptx.addSlide();
        
        // Background gradient cho slide title
        titleSlide.background = { color: 'F1F8E9' };
        
        // Tiêu đề chính
        titleSlide.addText('Note Report', {
            x: 1,
            y: 2,
            w: 8,
            h: 1.5,
            fontSize: 48,
            fontFace: 'Arial',
            bold: true,
            color: '2E7D32',
            align: 'center',
            valign: 'middle'
        });

        // Subtitle
        titleSlide.addText('Báo cáo tổng hợp các lỗi hệ thống', {
            x: 1,
            y: 3.8,
            w: 8,
            h: 0.8,
            fontSize: 20,
            fontFace: 'Arial',
            color: '424242',
            align: 'center',
            valign: 'middle'
        });

        // Thêm ngày tạo
        const currentDate = new Date().toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        titleSlide.addText(`Ngày tạo: ${currentDate}`, {
            x: 1,
            y: 4.8,
            w: 8,
            h: 0.5,
            fontSize: 14,
            fontFace: 'Arial',
            color: '757575',
            align: 'center'
        });

        // Thêm số lượng record
        titleSlide.addText(`Tổng số lỗi: ${filteredData.length - 1} record(s)`, {
            x: 1,
            y: 5.5,
            w: 8,
            h: 0.5,
            fontSize: 14,
            fontFace: 'Arial',
            color: '757575',
            align: 'center'
        });

        // Lấy dữ liệu (bỏ header)
        const dataRows = filteredData.slice(1);

        // Tạo slide cho từng record
        dataRows.forEach((row, index) => {
            const slide = pptx.addSlide();
            
            // Background nhẹ cho các slide data
            slide.background = { color: 'FAFAFA' };

            // Tiêu đề slide (ID + STT)
            slide.addText(`Lỗi #${index + 1}: ${row[0] || 'N/A'}`, {
                x: 0.5,
                y: 0.3,
                w: 9,
                h: 0.8,
                fontSize: 24,
                fontFace: 'Arial',
                bold: true,
                color: '1976D2',
                align: 'left'
            });

            // Đường kẻ ngăn cách
            slide.addText('', {
                x: 0.5,
                y: 1.1,
                w: 9,
                h: 0.02,
                fill: { color: 'E0E0E0' }
            });

            let yPos = 1.5; // Vị trí y bắt đầu cho nội dung

            // Mô tả lỗi
            if (row[1]) {
                slide.addText('Mô tả lỗi:', {
                    x: 0.5,
                    y: yPos,
                    w: 2,
                    h: 0.4,
                    fontSize: 14,
                    fontFace: 'Arial',
                    bold: true,
                    color: '424242'
                });
                
                slide.addText(row[1].toString(), {
                    x: 2.8,
                    y: yPos,
                    w: 6.7,
                    h: 0.4,
                    fontSize: 14,
                    fontFace: 'Arial',
                    color: '666666'
                });
                yPos += 0.6;
            }

            // Tiêu đề mail
            if (row[2]) {
                slide.addText('Tiêu đề mail:', {
                    x: 0.5,
                    y: yPos,
                    w: 2,
                    h: 0.4,
                    fontSize: 14,
                    fontFace: 'Arial',
                    bold: true,
                    color: '424242'
                });
                
                slide.addText(row[2].toString(), {
                    x: 2.8,
                    y: yPos,
                    w: 6.7,
                    h: 0.4,
                    fontSize: 14,
                    fontFace: 'Arial',
                    color: '666666'
                });
                yPos += 0.6;
            }

            // Vấn đề lỗi
            if (row[3]) {
                slide.addText('Vấn đề lỗi:', {
                    x: 0.5,
                    y: yPos,
                    w: 2,
                    h: 0.4,
                    fontSize: 14,
                    fontFace: 'Arial',
                    bold: true,
                    color: '424242'
                });
                
                const problemText = row[3].toString();
                const problemHeight = Math.max(0.8, Math.ceil(problemText.length / 60) * 0.4);
                
                slide.addText(problemText, {
                    x: 2.8,
                    y: yPos,
                    w: 6.7,
                    h: problemHeight,
                    fontSize: 13,
                    fontFace: 'Arial',
                    color: '666666',
                    valign: 'top'
                });
                yPos += problemHeight + 0.2;
            }

            // Cách fix
            if (row[4]) {
                slide.addText('Cách fix:', {
                    x: 0.5,
                    y: yPos,
                    w: 2,
                    h: 0.4,
                    fontSize: 14,
                    fontFace: 'Arial',
                    bold: true,
                    color: '424242'
                });
                
                const solutionText = row[4].toString();
                const solutionHeight = Math.max(0.8, Math.ceil(solutionText.length / 60) * 0.4);
                
                slide.addText(solutionText, {
                    x: 2.8,
                    y: yPos,
                    w: 6.7,
                    h: solutionHeight,
                    fontSize: 13,
                    fontFace: 'Arial',
                    color: '666666',
                    valign: 'top'
                });
                yPos += solutionHeight + 0.2;
            }

            // Thời gian
            if (row[5]) {
                slide.addText('Thời gian:', {
                    x: 0.5,
                    y: yPos,
                    w: 2,
                    h: 0.4,
                    fontSize: 14,
                    fontFace: 'Arial',
                    bold: true,
                    color: '424242'
                });
                
                slide.addText(formatDateTime(row[5]), {
                    x: 2.8,
                    y: yPos,
                    w: 6.7,
                    h: 0.4,
                    fontSize: 14,
                    fontFace: 'Arial',
                    color: '666666'
                });
                yPos += 0.6;
            }

            // Link ảnh (nếu có)
            if (row[6] && row[6].toString().trim()) {
                slide.addText('Link ảnh:', {
                    x: 0.5,
                    y: yPos,
                    w: 2,
                    h: 0.4,
                    fontSize: 14,
                    fontFace: 'Arial',
                    bold: true,
                    color: '424242'
                });

                const imageLinks = row[6].toString().split(/\r?\n|,|;/)
                    .map(l => l.trim())
                    .filter(l => l)
                    .slice(0, 3); // Chỉ hiển thị tối đa 3 link

                imageLinks.forEach((link, linkIndex) => {
                    slide.addText(link, {
                        x: 2.8,
                        y: yPos + (linkIndex * 0.3),
                        w: 6.7,
                        h: 0.3,
                        fontSize: 10,
                        fontFace: 'Arial',
                        color: '1976D2',
                        hyperlink: { url: link }
                    });
                });
                yPos += (imageLinks.length * 0.3) + 0.3;
            }

            // Footer với số trang
            slide.addText(`${index + 2} / ${dataRows.length + 1}`, {
                x: 8.5,
                y: 6.8,
                w: 1,
                h: 0.3,
                fontSize: 10,
                fontFace: 'Arial',
                color: '999999',
                align: 'center'
            });
        });

        // Tạo tên file với timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const fileName = `Note_Report_${timestamp}.pptx`;

        // Xuất file
        pptx.writeFile({ fileName: fileName }).then(() => {
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

// Gửi form
const form = document.forms['contact-form'];
form.addEventListener('submit', async e => {
    e.preventDefault();
    const formData = new FormData(form);
    const id = formData.get('id').trim();
    if (!id) { showNotification('ID lỗi không được để trống.', true); return; }

    toggleLoader(true);
    try {
        const response = await fetch(scriptURL, { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Có lỗi khi gửi form. Mã lỗi: ' + response.status);
        const data = await response.json();
        showNotification('Dữ liệu đã được gửi thành công!');
        form.reset();
        setDefaultTimestamp();

        // Chuẩn hóa link ảnh xuống dòng
        let links = formData.get('link').trim();
        links = links.split(/\r?\n|,|;/).map(l => l.trim()).filter(l => l).join('\n');

        const newRow = [
            formData.get('id'),
            formData.get('issue'),
            formData.get('subject'),
            formData.get('why'),
            formData.get('how'),
            formData.get('timestamp'),
            links
        ];

        sheetData.push(newRow);
        if (!document.getElementById('searchInput').value) filteredData = sheetData;

        const newRowIndex = sheetData.length - 1;
        currentPage = Math.ceil(newRowIndex / itemsPerPage);
        displayData(filteredData, currentPage);
    } catch (error) {
        console.error('Lỗi!', error.message);
        showNotification('Đã xảy ra lỗi: ' + error.message, true);
    } finally { toggleLoader(false); }
});

document.getElementById('searchInput').addEventListener('input', searchTable);
document.getElementById('refreshButton').addEventListener('click', fetchGoogleSheetData);
document.getElementById('exportButton').addEventListener('click', exportToExcel);
document.getElementById('exportPptxButton').addEventListener('click', exportToPptx);

window.onload = () => {
    fetchGoogleSheetData();
    setDefaultTimestamp();
     setTimeout(() => {
        if (typeof PptxGenJS === 'undefined') {
            console.warn('PptxGenJS chưa được tải');
        } else {
            console.log('PptxGenJS đã sẵn sàng');
        }
    }, 2000);
};
