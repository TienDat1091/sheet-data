// --- Hàm đóng modal ---
function closeModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

// --- Hàm mở modal để xem ảnh phóng to ---
function openModal(imageSrc) {
    // Tạo modal nếu chưa có
    let modal = document.getElementById('imageModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'imageModal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            transition: opacity 0.3s ease-in-out;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 90%;
            max-height: 90%;
            background: white;
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;
        
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            background: #ff4444;
            color: white;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            font-size: 18px;
            cursor: pointer;
            font-weight: bold;
        `;
        
        const modalImage = document.createElement('img');
        modalImage.id = 'modalImage';
        modalImage.style.cssText = `
            width: 100%;
            height: auto;
            max-width: 80vw;
            max-height: 80vh;
            object-fit: contain;
            border-radius: 4px;
        `;
        modalImage.alt = 'Enlarged image';
        
        modalContent.appendChild(closeButton);
        modalContent.appendChild(modalImage);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Thêm event listeners
        closeButton.addEventListener('click', closeModal);
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        });
    }
    
    // Hiển thị modal
    const modalImage = document.getElementById('modalImage');
    modal.style.display = 'block';
    modalImage.src = imageSrc;
    
    // Thêm animation fade in
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.style.opacity = '1';
    }, 10);
}

// Hiển thị thông báo

// Loader

// Tạo ID tự động

// Đặt thời gian mặc định

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

// Tìm kiếm

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
                    links.forEach((link, linkIndex) => {
                        const img = document.createElement('img');
                        img.src = link;
                        img.alt = 'image';
                        img.style.cssText = 'max-width:100px;max-height:100px;cursor:pointer;display:block;margin-bottom:5px;border-radius:4px;';
                        img.classList.add('clickable-img');
                        
                        // Thêm event listener thay vì onclick
                        img.addEventListener('click', function() {
                            openModal(link);
                        });
                        
                        td.appendChild(img);
                    });
                } 
                // Cột H chứa ảnh (index = 7)
                else {
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
document.getElementById('filterButton').addEventListener('click', filterByDate);
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