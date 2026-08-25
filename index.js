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
     callback(null, false);
    }
  }
}));

app.use(express.json({ limit: '20mb' }));

// Rate limit: max 20 photo counts per IP per hour
const estimateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.post('/estimate', estimateLimiter, async (req, res) => {
    console.log('Estimate request at', new Date().toISOString(), 'origin:', req.headers.origin);
    try {
      const { image } = req.body;
      console.log('Image received, base64 length:', image ? image.length : 0);
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
       model: 'claude-sonnet-5',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: 'You are counting livestock animals in this photo. Follow these rules strictly. Count only live goats, sheep, cows, or chickens. Do not count humans, vehicles, feeders, water troughs, buildings, or shadows. If two animals overlap or touch, count each one only once, do not double count. Do not count partial animals that are cut off at the edge of the frame unless more than half the body is visible. Be conservative. If you are unsure whether something is an animal or how many animals are in a cluster, count fewer rather than more. Reply with only a single number, nothing else.' }
          ]
        }]
      })
    });

    const data = await response.json();
           if (!response.ok) {
      console.error('Anthropic API error:', response.status, data);
      return res.status(502).json({
        code: 'ANTHROPIC_API_ERROR',
        error: 'The AI service is having trouble right now. Please try again in a minute.'
      });
    }
    console.log('Anthropic response received:', JSON.stringify(data).slice(0, 200));
    if (!data.content || !data.content[0] || !data.content[0].text) {
      console.error('Malformed AI response:', data);
      return res.status(502).json({
        code: 'MALFORMED_RESPONSE',
        error: 'The AI response was not in the expected format. Please try again.'
      });
    }
    const rawText = data.content[0].text.trim();
    const count = parseInt(rawText);
    if (isNaN(count)) {
      console.error('Could not parse count from AI response:', rawText);
      return res.status(502).json({
        code: 'PARSE_ERROR',
        error: 'The AI response could not be turned into a number. Please try again.'
      });
    }
    res.json({ count: count });
  } catch (err) {
    console.error('Estimate handler error:', err.message, err.stack);
    if (err.name === 'AbortError' || err.message.includes('timeout')) {
      return res.status(504).json({
        code: 'TIMEOUT',
        error: 'The AI service is slow right now. Please try again in a minute.'
      });
    }
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      error: 'Something unexpected went wrong. Please try again.'
    });
  }
});

app.get('/', (req, res) => res.send('Animal Counter API running'));

app.use((err, req, res, next) => {
  console.error('Unhandled Express error:', err.message, err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    type: err.type || 'unknown'
  });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
