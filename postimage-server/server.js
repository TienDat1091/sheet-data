const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const upload = multer(); // dùng bộ nhớ tạm

const API_KEY = "8901cf868dc0f724277559582aa60fb9"; // thay bằng key của bạn

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const formData = new FormData();
    formData.append("key", API_KEY);
    formData.append("image", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const response = await axios.post(
      "https://api.postimages.org/1/upload",
      formData,
      { headers: formData.getHeaders() }
    );

    res.json(response.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Upload lỗi: " + err.message });
  }
});

app.listen(5000, () => {
  console.log("Server chạy ở http://localhost:5000");
});
