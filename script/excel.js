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
