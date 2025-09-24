function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#f44336' : '#4CAF50';
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

function toggleLoader(show) {
    document.getElementById('loader').style.display = show ? 'inline-block' : 'none';
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

// Nút làm mới filter
document.getElementById('resetFilterButton').addEventListener('click', () => {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    filteredData = sheetData; // Trả về toàn bộ dữ liệu gốc
    currentPage = 1;
    displayData(filteredData, currentPage);
});

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







