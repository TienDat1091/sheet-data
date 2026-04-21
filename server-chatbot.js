require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GOOGLE_API_KEY;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Serve static files from chatbot folder
app.use(express.static('chatbot'));
app.use(express.static('public'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Google Generative AI Proxy
app.post('/api/chat', async (req, res) => {
    try {
        const { model = 'gemini-1.5-flash', contents, system_instruction } = req.body;

        if (!API_KEY) {
            return res.status(500).json({ 
                error: 'API key not configured',
                message: 'Please set GOOGLE_API_KEY in .env file'
            });
        }

        // Build request payload for Google API
        const payload = {
            contents: contents,
            safetySettings: [
                {
                    category: 'HARM_CATEGORY_UNSPECIFIED',
                    threshold: 'BLOCK_NONE'
                }
            ]
        };

        // Add system instruction if provided
        if (system_instruction) {
            payload.system_instruction = system_instruction;
        }

        // Call Google Generative AI API
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Error calling Google API:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error?.message || 'Internal server error',
            details: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Chatbot server is running on http://localhost:${PORT}`);
    console.log('📚 Access chatbot at http://localhost:' + PORT);
    console.log(`🔑 API Key configured: ${API_KEY ? 'Yes (from .env)' : 'No - set GOOGLE_API_KEY in .env'}`);
});

