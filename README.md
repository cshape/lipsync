# Lip Sync Visualization

Real-time lip sync visualization using Inworld TTS with phoneme-based animation.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the project root with your API key:
```
INWORLD_API_KEY=your-api-key-here
```

3. Start the server:
```bash
npm start
```

Your browser will open automatically to http://localhost:3000

## How It Works

- Uses Inworld TTS (inworld-tts-1.5-max) via the dev API
- Streams audio with phoneme timestamps
- Maps phonemes to 12 viseme mouth shapes for lip sync animation

## Visemes

| Viseme | Description | Example |
|--------|-------------|---------|
| `bmp` | Lips together | **b**oy, **m**ay, **p**ay |
| `fv` | Teeth on lip | **f**ish, **v**ery |
| `th` | Tongue between teeth | **th**ink |
| `l` | Tongue to ridge | **l**ove |
| `cdgknstxyz` | Alveolar consonants | **t**op, **s**it |
| `chjsh` | Postalveolar | **sh**ip, **ch**urch |
| `r` | R sound | **r**ed |
| `qw` | W sound | **w**et |
| `ee` | High front vowels | b**ee**t |
| `aei` | Open vowels | b**a**t, b**e**t |
| `o` | Rounded vowels | b**oa**t |
| `u` | High back rounded | b**oo**t |

Thanks to [this blog](https://medium.com/@yashrajbharti.met18/lipsyncing-made-dead-simple-using-pure-css-e345ce604c94) from [Yash Raj Bharti](https://www.linkedin.com/in/yash-raj-bharti/) which got me started.