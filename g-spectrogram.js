Polymer('g-spectrogram', {
  // Show the controls UI.
  controls: false,
  // Log mode.
  log: false,
  // Show axis labels, and how many ticks.
  labels: false,
  ticks: 5,
  speed: 2,
  // FFT bin size,
  fftsize: 2048,
  oscillator: false,
  color: false,

  attachedCallback: async function() {
    this.tempCanvas = document.createElement('canvas'),
    console.log('Created spectrogram');

    // Require user gesture before creating audio context, etc.
    window.addEventListener('mousedown', () => this.createAudioGraph());
    window.addEventListener('touchstart', () => this.createAudioGraph());
  },

  createAudioGraph: async function() {
    if (this.audioContext) {
      return;
    }
    // Get input from the microphone.
    this.audioContext = new AudioContext();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      this.ctx = this.$.canvas.getContext('2d');
      this.onStream(stream);
    } catch (e) {
      this.onStreamError(e);
    }
  },

  render: function() {
    //console.log('Render');
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    var didResize = false;
    // Ensure dimensions are accurate.
    if (this.$.canvas.width != this.width) {
      this.$.canvas.width = this.width;
      this.$.labels.width = this.width;
      didResize = true;
    }
    if (this.$.canvas.height != this.height) {
      this.$.canvas.height = this.height;
      this.$.labels.height = this.height;
      didResize = true;
    }

    //this.renderTimeDomain();
    this.renderFreqDomain();

    if (this.labels && didResize) {
      this.renderAxesLabels();
    }

    requestAnimationFrame(this.render.bind(this));

    var now = new Date();
    if (this.lastRenderTime_) {
      this.instantaneousFPS = now - this.lastRenderTime_;
    }
    this.lastRenderTime_ = now;
  },

  renderTimeDomain: function() {
    var times = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(times);

    for (var i = 0; i < times.length; i++) {
      var value = times[i];
      var percent = value / 256;
      var barHeight = this.height * percent;
      var offset = this.height - barHeight - 1;
      var barWidth = this.width/times.length;
      this.ctx.fillStyle = 'black';
      this.ctx.fillRect(i * barWidth, offset, 1, 1);
    }
  },

  renderFreqDomain: function() {
    var minFreqIndex = this.freqToIndex(40);
    var maxFreqIndex = this.freqToIndex(8000);

    this.analyser.getByteFrequencyData(this.freq);

    var ctx = this.ctx;
    this.tempCanvas.width = this.width;
    this.tempCanvas.height = this.height;
    var tempCtx = this.tempCanvas.getContext('2d');
    tempCtx.drawImage(this.$.canvas, 0, 0, this.width, this.height);

    for (var i = minFreqIndex; i <= maxFreqIndex; i++) {
      var value = this.freq[i];
      ctx.fillStyle = (this.color ? this.getFullColor(value) : this.getGrayColor(value));

      var percent = (i - minFreqIndex) / (maxFreqIndex - minFreqIndex);
      var y = Math.round(percent * this.height);

      ctx.fillRect(this.width - this.speed, this.height - y, this.speed, this.speed);
    }

    ctx.translate(-this.speed, 0);
    ctx.drawImage(this.tempCanvas, 0, 0, this.width, this.height, 0, 0, this.width, this.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },
  
  /**
   * Given an index and the total number of entries, return the
   * log-scaled value.
   */
  logScale: function(index, total, opt_base) {
    var base = opt_base || 2;
    var logmax = this.logBase(total + 1, base);
    var exp = logmax * index / total;
    return Math.round(Math.pow(base, exp) - 1);
  },

  logBase: function(val, base) {
    return Math.log(val) / Math.log(base);
  },renderAxesLabels: function() {
  if (!this.audioContext) {
    return;
  }
  var canvas = this.$.labels;
  canvas.width = this.width;
  canvas.height = this.height;
  var ctx = canvas.getContext('2d');

  var startFreq = 20;
  var endFreq = 8000;
  var step = (endFreq - startFreq) / this.ticks;
  var yLabelOffset = 5;

  // Render the vertical frequency axis.
  for (var i = 0; i <= this.ticks; i++) {
    var freq;
    var index;
    if (this.log) {
      var logRatio = (Math.log(i + 1) - Math.log(1)) / (Math.log(this.ticks + 1) - Math.log(1));
      freq = startFreq * Math.pow(endFreq / startFreq, logRatio);
      index = this.freqToIndex(freq);
    } else {
      freq = startFreq + (step * i);
      index = this.freqToIndex(freq);
    }

    var percent = (index - this.freqToIndex(startFreq)) / (this.freqToIndex(endFreq) - this.freqToIndex(startFreq));
    var y = (1 - percent) * this.height;
    var x = this.width - 60;

    var label = this.formatFreq(freq);
    var units = this.formatUnits(freq);
    ctx.font = '16px Inconsolata';
    ctx.textAlign = 'right';
    ctx.fillText(label, x, y + yLabelOffset);
    ctx.textAlign = 'left';
    ctx.fillText(units, x + 10, y + yLabelOffset);
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
