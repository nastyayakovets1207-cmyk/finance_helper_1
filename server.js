const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
    apiKey: process.env.QWEN_API_KEY,
    baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Qwen backend is running' });
});

app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }
    
    try {
        const completion = await client.chat.completions.create({
            model: "qwen-plus",
            messages: messages,
            temperature: 0.7,
            max_tokens: 2000,
        });
        
        const reply = completion.choices[0].message.content;
        res.json({ reply: reply });
        
    } catch (error) {
        console.error('Qwen API Error:', error);
        res.status(500).json({ error: error.message || 'Failed to get response' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Qwen backend server running on port ${PORT}`);
});
