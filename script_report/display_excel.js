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

window.onload = () => {
    fetchGoogleSheetData();
};