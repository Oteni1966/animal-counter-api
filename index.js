const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/estimate', async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'No image provided' });

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-opus-4-5',
                max_tokens: 256,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
                        { type: 'text', text: 'Count all animals in this photo. Reply with only a number.' }
                    ]
                }]
            })
        });

        const data = await response.json();
        const count = parseInt(data.content[0].text.trim());
        res.json({ count: isNaN(count) ? 0 : count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => res.send('Animal Counter API running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));