Polymer('g-spectrogram', {
  properties: {
    controls: { type: Boolean, value: false },
    log: { type: Boolean, value: false },
    labels: { type: Boolean, value: false },
    ticks: { type: Number, value: 5 },
    speed: { type: Number, value: 2 },
    fftsize: { type: Number, value: 2048 },
    oscillator: { type: Boolean, value: false },
    color: { type: Boolean, value: false },
    minFreq: { type: Number, value: 20 },
    maxFreq: { type: Number, value: 9000 }
  },

  attached: function() {
    this.audioContext = null;
    this.tempCanvas = document.createElement('canvas');
    window.addEventListener('mousedown', () => this.initAudioGraph());
    window.addEventListener('touchstart', () => this.initAudioGraph());
  },

  initAudioGraph: async function() {
    if (this.audioContext) return;
    this.audioContext = new AudioContext();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.ctx = this.$.canvas.getContext('2d');
      this.setupStream(stream);
    } catch (e) {
      console.error('Stream error:', e);
    }
  },

  setupStream: function(stream) {
    var input = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.fftsize;
    input.connect(this.analyser);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.render();
  },

  render: function() {
    this.adjustCanvasSize();
    this.renderFrequencyData();
    requestAnimationFrame(this.render.bind(this));
  },

  adjustCanvasSize: function() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    var canvasResized = this.adjustElementSize(this.$.canvas, this.width, this.height);
    if (this.labels && canvasResized) {
      this.renderAxesLabels();
    }
  },

  adjustElementSize: function(element, width, height) {
    var resized = false;
    if (element.width !== width) {
      element.width = width;
      resized = true;
    }
    if (element.height !== height) {
      element.height = height;
      resized = true;
    }
    return resized;
  },

  renderFrequencyData: function() {
    this.analyser.getByteFrequencyData(this.freqData);
    var ctx = this.ctx;
    ctx.translate(-this.speed, 0);
    ctx.drawImage(this.tempCanvas, 0, 0, this.width, this.height, 0, 0, this.width, this.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.tempCanvas.width = this.width;
    this.tempCanvas.height = this.height;
    var tempCtx = this.tempCanvas.getContext('2d');
    tempCtx.drawImage(this.$.canvas, 0, 0, this.width, this.height);

    for (let i = 0; i < this.freqData.length; i++) {
      let frequency = this.indexToFreq(i);
      if (frequency < this.minFreq || frequency > this.maxFreq) continue;

      let value = this.freqData[i];
      ctx.fillStyle = this.color ? this.getFullColor(value) : this.getGrayColor(value);
      let percent = i / this.freqData.length;
      let y = Math.round(percent * this.height);
      ctx.fillRect(this.width - this.speed, this.height - y, this.speed, this.speed);
    }
  },

  indexToFreq: function(index) {
    let nyquist = this.audioContext.sampleRate / 2;
    return nyquist / this.getFFTBinCount() * index;
  },

  renderAxesLabels: function() {
    if (!this.audioContext) {
      return;
    }
    var canvas = this.$.labels;
    canvas.width = this.width;
    canvas.height = this.height;
    var ctx = canvas.getContext('2d');
    var startFreq = 40;
    // var nyquist = this.audioContext.sampleRate/2;
    // alert(nyquist.toString());
    // var endFreq = 9000;
    var endFreq = nyquist - startFreq;
    var step = (endFreq - startFreq) / this.ticks;
    var yLabelOffset = 5;
    // Render the vertical frequency axis.
    for (var i = 0; i <= this.ticks; i++) {
      var freq = startFreq + (step * i);
      // Get the y coordinate from the current label.
      var index = this.freqToIndex(freq);
      var percent = index / this.getFFTBinCount();
      var y = (1-percent) * this.height;
      var x = this.width - 60;
      // Get the value for the current y coordinate.
      var label;
      if (this.log) {
        // Handle a logarithmic scale.
        var logIndex = this.logScale(index, this.getFFTBinCount());
        // alert(this.getFFTBinCount().toString());
        // Never show 0 Hz.
        freq = Math.max(20, this.indexToFreq(logIndex));
      }
      var label = this.formatFreq(freq);
      var units = this.formatUnits(freq);
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
  },

  clearAxesLabels: function() {
    var canvas = this.$.labels;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, this.width, this.height);
  },

  formatFreq: function(freq) {
    return (freq >= 1000 ? (freq/1000).toFixed(1) : Math.round(freq));
  },

  formatUnits: function(freq) {
    return (freq >= 1000 ? 'KHz' : 'Hz');
  },

  indexToFreq: function(index) {
    var nyquist = this.audioContext.sampleRate/2;
    return nyquist/this.getFFTBinCount() * index;
  },

  freqToIndex: function(frequency) {
    var nyquist = this.audioContext.sampleRate/2;
    return Math.round(frequency/nyquist * this.getFFTBinCount());
  },

  getFFTBinCount: function() {
    return this.fftsize / 2;
  },

  onStream: function(stream) {
    var input = this.audioContext.createMediaStreamSource(stream);
    var analyser = this.audioContext.createAnalyser();
    analyser.smoothingTimeConstant = 0;
    analyser.fftSize = this.fftsize;

    // Connect graph.
    input.connect(analyser);

    this.analyser = analyser;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);

    // Setup a timer to visualize some stuff.
    this.render();
  },

  onStreamError: function(e) {
    console.error(e);
  },

  getGrayColor: function(value) {
    return 'rgb(V, V, V)'.replace(/V/g, 255 - value);
  },

  getFullColor: function(value) {
    var fromH = 62;
    var toH = 0;
    var percent = value / 255;
    var delta = percent * (toH - fromH);
    var hue = fromH + delta;
    return 'hsl(H, 100%, 50%)'.replace(/H/g, hue);
  },
  
  logChanged: function() {
    if (this.labels) {
      this.renderAxesLabels();
    }
  },

  ticksChanged: function() {
    if (this.labels) {
      this.renderAxesLabels();
    }
  },

  labelsChanged: function() {
    if (this.labels) {
      this.renderAxesLabels();
    } else {
      this.clearAxesLabels();
    }
  }
});
