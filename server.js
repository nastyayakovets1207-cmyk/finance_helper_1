const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();

// Настройка CORS для всех маршрутов
app.use(cors());
app.use(express.json());

// Проверка наличия API ключа при старте
if (!process.env.QWEN_API_KEY) {
    console.error('ERROR: QWEN_API_KEY environment variable is not set!');
}

const client = new OpenAI({
    apiKey: process.env.QWEN_API_KEY || 'dummy-key', // fallback чтобы не падало при отсутствии
    baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});

// Health check - РАБОТАЕТ
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Qwen backend is running',
        timestamp: new Date().toISOString(),
        apiKeyConfigured: !!process.env.QWEN_API_KEY
    });
});

// Корневой маршрут для проверки
app.get('/', (req, res) => {
    res.json({ 
        message: 'Finance Helper Backend API',
        endpoints: ['GET /health', 'POST /api/chat'],
        status: 'operational'
    });
});

// Основной чат эндпоинт
app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }
    
    // Проверка API ключа перед запросом
    if (!process.env.QWEN_API_KEY) {
        console.error('API key missing when processing /api/chat');
        return res.status(500).json({ error: 'API key not configured on server' });
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
        // Отправляем более понятную ошибку
        res.status(500).json({ 
            error: 'Failed to get response from AI service',
            details: error.message 
        });
    }
});

// Обработка 404 для несуществующих маршрутов
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        requestedPath: req.path
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {  // Явно слушаем все интерфейсы
    console.log(`✅ Qwen backend server running on port ${PORT}`);
    console.log(`✅ Health check available at: http://localhost:${PORT}/health`);
    console.log(`✅ API key configured: ${!!process.env.QWEN_API_KEY}`);
});
