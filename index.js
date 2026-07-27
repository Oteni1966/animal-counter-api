const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// Trust Railway's proxy so rate limiting sees real client IPs
app.set('trust proxy', 1);

// Lock CORS to Oliviachicks domains only
const allowedOrigins = [
  'https://oliviachicks.com',
  'https://www.oliviachicks.com',
  'https://counter.oliviachicks.com',
  'https://oliviachicks-ai-counter.netlify.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json({ limit: '10mb' }));

// Rate limit: max 20 photo counts per IP per hour
const estimateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.post('/estimate', estimateLimiter, async (req, res) => {
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
