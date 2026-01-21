// Inworld viseme symbols
const lipSyncTypes = ["aei", "bmp", "cdgknstxyz", "chjsh", "ee", "fv", "l", "o", "qw", "r", "th", "u"];

// Blink Controller - random interval blinking with occasional double-blinks
class BlinkController {
  constructor(eyeElements) {
    this.eyes = eyeElements;
    this.isBlinking = false;
    this.scheduleNextBlink();
  }

  scheduleNextBlink() {
    const delay = 2000 + Math.random() * 4000; // 2-6 seconds
    setTimeout(() => this.blink(), delay);
  }

  blink() {
    if (this.isBlinking) return;
    this.isBlinking = true;

    this.eyes.forEach(eye => eye.classList.add('blinking'));

    setTimeout(() => {
      this.eyes.forEach(eye => eye.classList.remove('blinking'));
      this.isBlinking = false;

      // 20% chance of double blink
      if (Math.random() < 0.2) {
        setTimeout(() => this.blink(), 150);
      } else {
        this.scheduleNextBlink();
      }
    }, 150);
  }
}

// Eye Tracker - follows mouse with parallax depth
class EyeTracker {
  constructor(faceElement) {
    this.face = faceElement;
    this.irises = faceElement.querySelectorAll('.iris');
    this.pupils = faceElement.querySelectorAll('.pupil');
    this.mouseX = 0;
    this.mouseY = 0;
    this.lastMouseMove = Date.now();
    this.idleTimeout = null;
    this.maxOffset = 2;
    this.pupilMultiplier = 1.15;

    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.startIdleMovement();
  }

  onMouseMove(e) {
    this.lastMouseMove = Date.now();
    clearTimeout(this.idleTimeout);

    const faceRect = this.face.getBoundingClientRect();
    const faceCenterX = faceRect.left + faceRect.width / 2;
    const faceCenterY = faceRect.top + faceRect.height / 2;

    const deltaX = e.clientX - faceCenterX;
    const deltaY = e.clientY - faceCenterY;

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxDistance = 300;
    const normalizedDistance = Math.min(distance / maxDistance, 1);

    const offsetX = (deltaX / Math.max(distance, 1)) * this.maxOffset * normalizedDistance;
    const offsetY = (deltaY / Math.max(distance, 1)) * this.maxOffset * normalizedDistance;

    this.applyOffset(offsetX, offsetY);
    this.scheduleIdleMovement();
  }

  applyOffset(x, y) {
    this.irises.forEach(iris => {
      iris.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    });
    this.pupils.forEach(pupil => {
      pupil.style.transform = `translate(calc(-50% + ${x * this.pupilMultiplier}px), calc(-50% + ${y * this.pupilMultiplier}px))`;
    });
  }

  scheduleIdleMovement() {
    this.idleTimeout = setTimeout(() => this.startIdleMovement(), 3000);
  }

  startIdleMovement() {
    if (Date.now() - this.lastMouseMove < 2000) return;

    const randomX = (Math.random() - 0.5) * this.maxOffset * 0.3;
    const randomY = (Math.random() - 0.5) * this.maxOffset * 0.3;
    this.applyOffset(randomX, randomY);

    this.idleTimeout = setTimeout(() => this.startIdleMovement(), 2000 + Math.random() * 2000);
  }
}

function mapViseme(visemeSymbol) {
  if (!visemeSymbol) return 'bmp';
  if (lipSyncTypes.includes(visemeSymbol)) return visemeSymbol;
  if (visemeSymbol === 'sil') return 'bmp';
  return 'aei';
}

class AudioPlayer {
  constructor(mouthElement, logElement, faceElement) {
    this.mouthElement = mouthElement;
    this.logElement = logElement;
    this.faceElement = faceElement;
    this.audioContext = null;
    this.isPlaying = false;
    this.playbackStartTime = null;
    this.nextScheduleTime = 0;
    this.phonemeTimestamps = [];
    this.pendingOggChunks = [];
    this.lastDecodedDuration = 0;
  }

  async init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  reset() {
    this.phonemeTimestamps = [];
    this.isPlaying = false;
    this.playbackStartTime = null;
    this.nextScheduleTime = 0;
    this.pendingOggChunks = [];
    this.lastDecodedDuration = 0;
    this.logElement.innerHTML = '';
  }

  startStreaming() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.playbackStartTime = this.audioContext.currentTime;
    this.nextScheduleTime = this.playbackStartTime;
    this.mouthElement.setAttribute('data-letters', 'aei');
    this.faceElement.classList.add('speaking');
    this.animateLipSync();
  }

  async addOggChunk(base64Data) {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    this.pendingOggChunks.push(bytes);

    const totalLength = this.pendingOggChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.pendingOggChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(combined.buffer.slice(0));
      const newDuration = audioBuffer.duration - this.lastDecodedDuration;

      if (newDuration > 0.01) {
        if (!this.isPlaying) this.startStreaming();

        const startSample = Math.floor(this.lastDecodedDuration * audioBuffer.sampleRate);
        const newSampleCount = audioBuffer.length - startSample;

        if (newSampleCount > 0) {
          const newBuffer = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            newSampleCount,
            audioBuffer.sampleRate
          );

          for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            newBuffer.getChannelData(channel).set(channelData.subarray(startSample));
          }

          const source = this.audioContext.createBufferSource();
          source.buffer = newBuffer;
          source.connect(this.audioContext.destination);
          source.start(this.nextScheduleTime);
          this.nextScheduleTime += newBuffer.duration;
        }

        this.lastDecodedDuration = audioBuffer.duration;
      }
    } catch (e) {
      // Not enough data yet
    }
  }

  setTimestamps(timestampInfo) {
    if (!timestampInfo?.wordAlignment) return;

    const wa = timestampInfo.wordAlignment;
    const phoneticDetails = wa.phoneticDetails || [];

    for (const wordDetail of phoneticDetails) {
      const phones = wordDetail.phones || [];
      for (const phone of phones) {
        const startTime = (phone.startTimeSeconds || 0) * 1000;
        const duration = (phone.durationSeconds || 0) * 1000;

        this.phonemeTimestamps.push({
          phoneme: phone.phoneSymbol || '',
          start: startTime,
          end: startTime + duration,
          viseme: mapViseme(phone.visemeSymbol)
        });
      }
    }

    // Fallback to word-level if no phonetic details
    if (this.phonemeTimestamps.length === 0 && wa.words) {
      for (let i = 0; i < wa.words.length; i++) {
        if (wa.words[i] === '[silence]') continue;
        this.phonemeTimestamps.push({
          phoneme: wa.words[i],
          start: wa.wordStartTimeSeconds[i] * 1000,
          end: wa.wordEndTimeSeconds[i] * 1000,
          viseme: 'aei'
        });
      }
    }

    this.updateLogDisplay();
  }

  streamComplete() {
    if (!this.isPlaying) return;

    // Wait for both audio AND all phonemes to finish
    const audioEndTime = (this.nextScheduleTime - this.audioContext.currentTime) * 1000;
    const currentTime = (this.audioContext.currentTime - this.playbackStartTime) * 1000;
    const lastPhonemeEnd = this.phonemeTimestamps.length > 0
      ? this.phonemeTimestamps[this.phonemeTimestamps.length - 1].end
      : 0;
    const phonemeTimeRemaining = Math.max(0, lastPhonemeEnd - currentTime);

    const timeUntilEnd = Math.max(audioEndTime, phonemeTimeRemaining);

    setTimeout(() => {
      this.isPlaying = false;
      this.mouthElement.setAttribute('data-letters', 'bmp');
      this.faceElement.classList.remove('speaking');
      // Remove all highlighting
      this.logElement.querySelectorAll('.log-entry').forEach((entry) => {
        entry.classList.remove('active');
      });
    }, Math.max(0, timeUntilEnd + 200));
  }

  updateLogDisplay() {
    this.logElement.innerHTML = '';
    this.phonemeTimestamps.forEach((p, index) => {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.id = `phoneme-${index}`;
      entry.innerHTML = `
        <span class="phoneme">${p.phoneme}</span>
        <span class="viseme">${p.viseme}</span>
      `;
      this.logElement.appendChild(entry);
    });
  }

  animateLipSync() {
    if (!this.isPlaying) return;

    const currentTime = (this.audioContext.currentTime - this.playbackStartTime) * 1000;

    if (this.phonemeTimestamps.length > 0) {
      // Find the current phoneme (one that has started but not ended yet)
      let currentIndex = -1;
      for (let i = this.phonemeTimestamps.length - 1; i >= 0; i--) {
        if (currentTime >= this.phonemeTimestamps[i].start) {
          currentIndex = i;
          break;
        }
      }

      if (currentIndex >= 0) {
        const current = this.phonemeTimestamps[currentIndex];
        this.mouthElement.setAttribute('data-letters', current.viseme);

        // Highlight current phoneme in log
        this.logElement.querySelectorAll('.log-entry').forEach((entry, i) => {
          entry.classList.toggle('active', i === currentIndex);
          if (i === currentIndex) entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    }

    if (this.isPlaying) {
      requestAnimationFrame(() => this.animateLipSync());
    }
  }
}

let player = null;
let isSpeaking = false;

async function speak(text) {
  if (isSpeaking) return;
  isSpeaking = true;

  const button = document.getElementById('talkButton');
  button.disabled = true;
  button.textContent = 'Speaking...';

  if (!player) {
    player = new AudioPlayer(
      document.querySelector('#face .mouth'),
      document.getElementById('phonemeLog'),
      document.getElementById('face')
    );
  }

  await player.init();
  player.reset();

  const response = await fetch(`/api/tts?text=${encodeURIComponent(text)}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      player.streamComplete();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.done) {
            player.streamComplete();
          } else if (data.type === 'chunk' && data.data) {
            player.addOggChunk(data.data);
          } else if (data.type === 'timestamps' && data.timestampInfo) {
            player.setTimestamps(data.timestampInfo);
          }
        } catch (e) {}
      }
    }
  }

  setTimeout(() => {
    isSpeaking = false;
    button.disabled = false;
    button.textContent = 'Talk';
  }, 500);
}

window.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('talkButton');
  const textInput = document.getElementById('textInput');
  const face = document.getElementById('face');

  button.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text) speak(text);
  });

  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') button.click();
  });

  document.querySelector('#face .mouth').setAttribute('data-letters', 'bmp');

  // Initialize eye animations
  const eyes = face.querySelectorAll('.eye');
  new BlinkController(eyes);
  new EyeTracker(face);
});
