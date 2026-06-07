const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve the entire root directory statically
app.use(express.static(__dirname));

// Serve device_create/public under /device_create/public as well (Express static handles this automatically via the root static middleware, but let's make it explicit)
app.use('/device_create', express.static(path.join(__dirname, 'device_create', 'public')));

// Root route redirects to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Program started successfully!`);
  console.log(`📚 Main Page (Note Report): http://localhost:${PORT}`);
  console.log(`🤖 Chatbot AI:              http://localhost:${PORT}/chatbot/index.html`);
  console.log(`📄 PDF Merge (Beta):        http://localhost:${PORT}/pdfmerge/index.html`);
  console.log(`⚡ Device Create:           http://localhost:${PORT}/device_create/public/index.html`);
  console.log(`==================================================\n`);
});
