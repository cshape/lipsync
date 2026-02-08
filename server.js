require('dotenv').config();
const express = require('express');

const INWORLD_API_KEY = process.env.INWORLD_API_KEY;
const VOICE_ID = "Clive";

if (!INWORLD_API_KEY) {
  console.error('Error: INWORLD_API_KEY is required');
  console.error('Add INWORLD_API_KEY=your-key to your .env file');
  process.exit(1);
}

const app = express();
const PORT = 3000;

app.use(express.static(__dirname));

app.get('/api/tts', async (req, res) => {
  const text = req.query.text || "Hello, how are you doing today?";
  const timestampsEnabled = req.query.timestamps !== '0';

  try {
    const body = {
      text,
      voiceId: VOICE_ID,
      modelId: "inworld-tts-1.5-max",
      audioConfig: { audioEncoding: "OGG_OPUS" }
    };
    if (timestampsEnabled) {
      body.timestampType = "WORD";
    }
    const response = await fetch('https://api.inworld.ai/tts/v1/voice:stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Grpc-Metadata-X-Authorization-Bearer-Type': 'studio_api',
        'Authorization': `Basic ${INWORLD_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      return res.status(response.status).json({ error: errorText });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        res.write('data: {"done": true}\n\n');
        res.end();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const data = JSON.parse(line);
          const result = data.result || data;

          if (result.audioContent) {
            res.write(`data: ${JSON.stringify({ type: 'chunk', data: result.audioContent })}\n\n`);
          }

          if (result.timestampInfo) {
            res.write(`data: ${JSON.stringify({ type: 'timestamps', timestampInfo: result.timestampInfo })}\n\n`);
          }
        } catch (e) {
          // Skip non-JSON lines
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Server running at ${url}`);
  const open = (await import('open')).default;
  open(url);
});
