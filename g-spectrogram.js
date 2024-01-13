class Spectrogram {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.tempCanvas = document.createElement('canvas');
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.controls = false;
    this.log = false;
    this.labels = false;
    this.ticks = 5;
    this.speed = 2;
    this.fftsize = 4096;
    this.oscillator = false;
    this.color = false;
    this.audioContext = null;
    this.analyser = null;
    this.freq = null;
    this.render();
  }

  async createAudioGraph() {
    if (this.audioContext) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.ctx = this.canvas.getContext('2d');
      this.onStream(stream);
    } catch (e) {
      console.error(e);
    }
  }

  async onStream(stream) {
    const input = this.audioContext.createMediaStreamSource(stream);
    const bandpassFilter = this.audioContext.createBiquadFilter();
    bandpassFilter.type = 'bandpass';
    bandpassFilter.frequency.value = 4500; // Center frequency between 20Hz and 9000Hz
    bandpassFilter.Q.value = Math.sqrt((9000 - 20) / 2) / 4500; // Q factor for the given frequency range

    const analyser = this.audioContext.createAnalyser();
    analyser.smoothingTimeConstant = 0;
    analyser.fftSize = this.fftsize;

    input.connect(bandpassFilter);
    bandpassFilter.connect(analyser);

    this.analyser = analyser;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);

    this.render();
  }

  render() {
    requestAnimationFrame(() => this.render());
    const now = Date.now();
    if (this.lastRenderTime_) {
      this.instantaneousFPS = now - this.lastRenderTime_;
    }
    this.lastRenderTime_ = now;

    // Render time domain or frequency domain based on log setting
    if (!this.log) {
      this.renderTimeDomain();
    } else {
      this.renderFreqDomain();
    }

    // Check if we need to render axis labels
    if (this.labels && this.audioContext) {
      this.renderAxesLabels();
    }
  }

  renderTimeDomain() {
    const times = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(times);

    for (let i = 0; i < times.length; i++) {
      const value = times[i];
      const percent = value / 256;
      const barHeight = this.height * percent;
      const offset = this.height - barHeight - 1;
      const barWidth = this.width / times.length;
      this.ctx.fillStyle = 'black';
      this.ctx.fillRect(i * barWidth, offset, 1, 1);
    }
  }

  renderFreqDomain() {
    this.analyser.getByteFrequencyData(this.freq);

    // Check if we're getting lots of zeros.
    if (this.freq[0] === 0) {
      console.warn(`Looks like zeros...`);
    }

    const ctx = this.ctx;
    const tempCtx = this.tempCanvas.getContext('2d');
    tempCtx.drawImage(this.canvas, 0, 0, this.width, this.height);

    for (let i = 0; i < this.freq.length; i++) {
      const value = this.log ? this.logScale(i, this.analyser.frequencyBinCount) : this.freq[i];
      ctx.fillStyle = this.color ? this.getFullColor(value) : this.getGrayColor(value);

      const percent = i / this.analyser.frequencyBinCount;
      const y = Math.round((1 - percent) * this.height);

      // draw the line at the right side of the canvas
      ctx.fillRect(this.width - this.speed, this.height - y, this.speed, this.speed);
    }

    ctx.translate(-this.speed, 0);
    tempCtx.drawImage(this.tempCanvas, 0, 0, this.width, this.height, 0, 0, this.width, this.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  logScale(index, total, opt_base) {
    const base = opt_base || 2;
    const logmax = this.logBase(total + 1, base);
    const exp = logmax * index / total;
    return Math.round(Math.pow(base, exp) - 1);
  }

  logBase(val, base) {
    return Math.log(val) / Math.log(base);
  }

  renderAxesLabels() {
    if (!this.audioContext) return;
    const canvas = this.$labels;
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    const startFreq = 440;
    const nyquist = this.audioContext.sampleRate / 2;
    const endFreq = nyquist - startFreq;
    const step = (endFreq - startFreq) / this.ticks;
    const yLabelOffset = 5;

    for (let i = 0; i <= this.ticks; i++) {
      const freq = startFreq + (step * i);
      // Get the y coordinate from the current label.
      const index = this.freqToIndex(freq);
      const percent = index / this.analyser.frequencyBinCount;
      const y = (1 - percent) * this.height;
      const x = this.width - 60;
      // Get the value for the current y coordinate.
      let label;
      if (this.log) {
        // Handle a logarithmic scale.
        const logIndex = this.logScale(index, this.analyser.frequencyBinCount);
        // Never show 0 Hz.
        freq = Math.max(1, this.indexToFreq(logIndex));
      }
      label = this.formatFreq(freq);
      const units = this.formatUnits(freq);
      ctx.font = '16px Inconsolata';
      // Draw the value.
      ctx.textAlign = 'right';
      ctx.fillText(label, x, y + yLabelOffset);
      // Draw the units.
      ctx.textAlign = 'left';
      ctx.fillText(units, x + 10, y + yLabelOffset);
      // Draw a tick mark.
      ctx.fillRect(x + 40, y, 30, 2);
    }
  }

  clearAxesLabels() {
    const canvas = this.$labels;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, this.width, this.height);
  }

  formatFreq(freq) {
    return (freq >= 1000 ? (freq / 1000).toFixed(1) : Math.round(freq));
  }

  formatUnits(freq) {
    return (freq >= 1000 ? 'KHz' : 'Hz');
  }

  indexToFreq(index) {
    const nyquist = this.audioContext.sampleRate / 2;
    return nyquist / this.analyser.frequencyBinCount * index;
  }

  freqToIndex(frequency) {
    const nyquist = this.audioContext.sampleRate / 2;
    return Math.round(frequency / nyquist * this.analyser.frequencyBinCount);
  }

  getFFTBinCount() {
    return this.fftsize / 2;
  }

  getFullColor(value) {
    const fromH = 99;
    const toH = 0;
    const percent = value / 255;
    const delta = percent * (toH - fromH);
    const hue = fromH + delta;
    return `hsl(${hue}, 100%, 50%)`;
  }

  getGrayColor(value) {
    return `rgb(${255 - value}, ${255 - value}, ${255 - value})`;
  }

  attach() {
    window.addEventListener('resize', () => this.render());
    this.createAudioGraph();
  }

  detach() {
    window.removeEventListener('resize', () => this.render());
  }
}
