import tkinter as tk
from tkinter import messagebox
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import os


# Thiết lập Google Sheets API
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
CREDS_FILE = r'C:\Users\MyRogStrixG\OneDrive\Máy tính\Sourcode\Local_Test\credentials.json'
SPREADSHEET_ID = '18ehCo3v-QeAyjEKump-ZffgsX2d2_Q2bljUaGvJvIK4'


def get_sheets_service():
    try:
        creds = Credentials.from_service_account_file(CREDS_FILE, scopes=SCOPES)
        service = build('sheets', 'v4', credentials=creds)
        return service
    except Exception as e:
        messagebox.showerror("Lỗi", f"Không thể kết nối với Google Sheets: {str(e)}")
        return None

def submit_data(): 
    name = entry_name.get()
    email = entry_email.get()
    message = entry_message.get("1.0", tk.END).strip()

    if not name or not email or not message:
        messagebox.showwarning("Cảnh báo", "Vui lòng điền đầy đủ tất cả các trường!")
        return

    service = get_sheets_service()
    if service:
        try:
            values = [[name, email, message]]
            body = {'values': values}
            result = service.spreadsheets().values().append(
                spreadsheetId=SPREADSHEET_ID,
                range='sheet1!A:C',  # Điều chỉnh phạm vi theo cấu trúc bảng tính
                valueInputOption='RAW',
                insertDataOption='INSERT_ROWS',
                body=body
            ).execute()
            messagebox.showinfo("Thành công", "Dữ liệu đã được lưu vào Google Sheet!")
            entry_name.delete(0, tk.END)
            entry_email.delete(0, tk.END)
            entry_message.delete("1.0", tk.END)
        except Exception as e:
            messagebox.showerror("Lỗi", f"Lỗi khi lưu dữ liệu: {str(e)}")

# Tạo giao diện Tkinter
root = tk.Tk()
root.title("Nhập Dữ Liệu vào Google Sheet")
root.geometry("400x400")

# Tiêu đề
label_title = tk.Label(root, text="Nhập Dữ Liệu", font=("Arial", 16))
label_title.pack(pady=10)

# Trường Họ và Tên
label_name = tk.Label(root, text="Họ và Tên:")
label_name.pack()
entry_name = tk.Entry(root, width=40)
entry_name.pack(pady=5)

# Trường Email
label_email = tk.Label(root, text="Email:")
label_email.pack()
entry_email = tk.Entry(root, width=40)
entry_email.pack(pady=5)

# Trường Thông Điệp
label_message = tk.Label(root, text="Thông Điệp:")
label_message.pack()
entry_message = tk.Text(root, height=5, width=40)
entry_message.pack(pady=5)

# Nút Gửi
button_submit = tk.Button(root, text="Gửi", command=submit_data)
button_submit.pack(pady=20)

# Chạy ứng dụng
root.mainloop()