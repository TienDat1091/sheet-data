const apiKey = 'AIzaSyBCF4lFlZFecrRPCZPCoPJRaUB3ZPGK2kk';
const spreadsheetId = '18ehCo3v-QeAyjEKump-ZffgsX2d2_Q2bljUaGvJvIK4';
const range = 'sheet1!A1:F';
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
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
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

    const todayIDs = data.slice(1).filter(row => row[0] && row[0].startsWith(datePrefix)).map(row => row[0]);
    let maxSerial = 0;
    todayIDs.forEach(id => {
        const serial = parseInt(id.slice(8), 10);
        if (!isNaN(serial) && serial > maxSerial) {
            maxSerial = serial;
        }
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

function setDefaultTimestamp() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const adjustedDate = new Date(now.getTime() - (offset * 60 * 1000));
    const formattedDate = adjustedDate.toISOString().slice(0, 16);
    document.getElementById('timestamp').value = formattedDate;
}

function displayData(data, page = 1) {
    const dataBody = document.getElementById('data');
    const errorDiv = document.getElementById('error');
    const paginationDiv = document.getElementById('pagination');

    dataBody.innerHTML = '';
    errorDiv.textContent = '';
    paginationDiv.innerHTML = '';

    if (data.length === 0 || data.length === 1) {
        errorDiv.textContent = 'Không tìm thấy dữ liệu phù hợp.';
        return;
    }

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = data.slice(1).slice(startIndex, endIndex);

    paginatedData.forEach((row) => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell || '';
            tr.appendChild(td);
        });
        dataBody.appendChild(tr);
    });

    const totalPages = Math.ceil((data.length - 1) / itemsPerPage);
    if (totalPages > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.disabled = page === 1;
        prevButton.addEventListener('click', () => {
            if (page > 1) {
                currentPage--;
                displayData(data, currentPage);
            }
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
            if (page < totalPages) {
                currentPage++;
                displayData(data, currentPage);
            }
        });
        paginationDiv.appendChild(nextButton);
    }

    updateAutoID();
}

async function fetchGoogleSheetData() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
    const errorDiv = document.getElementById('error');
    toggleLoader(true);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
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
        errorDiv.textContent = 'Lỗi khi tải dữ liệu từ Google Sheets. Vui lòng kiểm tra API Key hoặc kết nối.';
    } finally {
        toggleLoader(false);
    }
}

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

// Xuất dữ liệu ra Excel (xlsx)
function exportToExcel() {
    if (!sheetData || sheetData.length === 0) {
        showNotification("Không có dữ liệu để xuất!", true);
        return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "data.xlsx");
}

const form = document.forms['contact-form'];
form.addEventListener('submit', async e => {
    e.preventDefault();
    const formData = new FormData(form);
    const id = formData.get('id').trim();
    if (!id) {
        showNotification('ID lỗi không được để trống.', true);
        return;
    }

    toggleLoader(true);
    try {
        const response = await fetch(scriptURL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Có lỗi khi gửi form. Mã lỗi: ' + response.status);
        }

        const data = await response.json();
        showNotification('Dữ liệu đã được gửi thành công!');
        form.reset();
        setDefaultTimestamp();

        const newRow = [
            formData.get('id'),
            formData.get('issue'),
            formData.get('subject'),
            formData.get('why'),
            formData.get('how'),
            formData.get('timestamp')
        ];
        sheetData.push(newRow);
        if (!document.getElementById('searchInput').value) {
            filteredData = sheetData;
        }
        const newRowIndex = sheetData.length - 1;
        currentPage = Math.ceil(newRowIndex / itemsPerPage);
        displayData(filteredData, currentPage);
    } catch (error) {
        console.error('Lỗi!', error.message);
        showNotification('Đã xảy ra lỗi: ' + error.message, true);
    } finally {
        toggleLoader(false);
    }
});

document.getElementById('searchInput').addEventListener('input', searchTable);
document.getElementById('refreshButton').addEventListener('click', fetchGoogleSheetData);
document.getElementById('exportButton').addEventListener('click', exportToExcel);

window.onload = () => {
    fetchGoogleSheetData();
    setDefaultTimestamp();
};