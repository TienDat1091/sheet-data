const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware để phân tích JSON và bật CORS
app.use(express.json());
app.use(cors());

// Tải thông tin xác thực tài khoản dịch vụ
const credentials = require('C:/Users/MyRogStrixG/OneDrive/Máy tính/Sourcode/Local_Test/credentials.json');

// Cấu hình Google Sheets API
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

// ID Bảng tính (đã xác nhận từ URL)
const SPREADSHEET_ID = '18ehCo3v-QeAyjEKump-ZffgsX2d2_Q2bljUaGvJvIK4';

// Xử lý yêu cầu gửi dữ liệu
app.post('/submit', async (req, res) => {
    try {
        const { name, email, message } = req.body;

        // Thêm dữ liệu vào Google Sheet
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:C', // Điều chỉnh phạm vi theo cấu trúc bảng tính
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [[name, email, message]]
            }
        });

        res.json({ message: 'Dữ liệu đã được lưu thành công!' });
    } catch (error) {
        console.error('Lỗi khi lưu dữ liệu vào Google Sheet:', error);
        res.status(500).json({ error: error.message });
    }
});

// Khởi động máy chủ
app.listen(port, () => {
    console.log(`Máy chủ đang chạy tại http://localhost:${port}`);
});