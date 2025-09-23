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
                    td.innerHTML = links.map(l => `<a href="${l}" target="_blank">${l}</a>`).join('<br>');
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
    XLSX.writeFile(wb, "data_filtered.xlsx");
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

window.onload = () => {
    fetchGoogleSheetData();
    setDefaultTimestamp();
};
