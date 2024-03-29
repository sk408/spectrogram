Polymer('g-spectrogram', {
  // Show the controls UI.
  controls: false,
  // Log mode.
  log: true,
  // Show axis labels, and how many ticks.
  labels: true,
  ticks: 15,
  speed: 6,
  // FFT bin size,
  fftsize: 4096,

  color: true,
  animate1: true,
  attachedCallback: async function () {
    this.tempCanvas = document.createElement('canvas'),
      console.log('Created spectrogram');

    // Require user gesture before creating audio context, etc.
    let debounce;
    const createAudioGraphDebounced = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => this.createAudioGraph(), 100);
    };

    let touchstartX = 0;
    let touchstartY = 0;
    let time = 0;

    const handleGesture = (event) => {
      const elapsedTime = new Date().getTime() - time;
      const touchendX = event.changedTouches[0].screenX;
      const touchendY = event.changedTouches[0].screenY;
      const dx = touchendX - touchstartX;
      const dy = touchendY - touchstartY;
      const dist = Math.sqrt(dx * dx + dy * dy); // distance
      if (elapsedTime < 250 && elapsedTime > 5) {
        event.preventDefault();
      }
      if (!this.audioContext) { createAudioGraphDebounced(); }

      if (elapsedTime < 250 && elapsedTime > 1) {
        createAudioGraphDebounced();
      }
    };
    function onKeyDown(e) {
      if (e.key === " ")
        createAudioGraphDebounced();
    }

    window.addEventListener('mousedown', function (event) {
      if (event.target.type !== 'checkbox' && event.target.type !== 'range') {
        createAudioGraphDebounced();
      }
    });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener('touchstart', (event) => {
      touchstartX = event.changedTouches[0].screenX;
      touchstartY = event.changedTouches[0].screenY;
      time = new Date().getTime();
    });
    window.addEventListener('touchend', handleGesture);
    window.addEventListener('touchmove', function (event) {
      event.preventDefault();
    }, { passive: false });
  },

  createAudioGraph: async function () {
    if (this.audioContext) {
      if (!this.animate1) {
        this.animate1 = true;
        requestAnimationFrame(this.render.bind(this));
      } else if (this.animate1) {
        this.animate1 = false;
      }
      return;
    }
    this.audioContext = new AudioContext({ sampleRate: 48000 });
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        console.log("enumerateDevices() not supported.");
      } else {
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.mics = devices.filter(device => device.kind === 'audioinput');

        let selectedMic;
        if (this.mics.length > 1) {
          // Let the user select a microphone
          let micOptions = this.mics.map((mic, index) => `${index + 1}: ${mic.label}`).join('\n');
          let selectedMicIndex = prompt(`Please select a microphone:\n${micOptions}`);
          this.selectAndStartMic(this.mics[selectedMicIndex - 1]?.deviceId);
        } else {
          this.selectAndStartMic(this.mics[0]?.deviceId);
        }
        // const constraints = { audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined } };
        // const stream = await navigator.mediaDevices.getUserMedia(constraints);
        // this.ctx = this.$.canvas.getContext('2d');
        // this.onStream(stream);
        // this.createDecibelMeter();
      }
    } catch (e) {
      this.onStreamError(e);
    }
  },
  selectAndStartMic: async function (selected) {
    // let selectedMic;
    // if (this.mics.length > 1) {
    //     // Let the user select a microphone
    //     let micOptions = this.mics.map((mic, index) => `${index+1}: ${mic.label}`).join('\n');
    //     let selectedMicIndex = prompt(`Please select a microphone:\n${micOptions}`);
    //     selectedMic = this.mics[selectedMicIndex - 1]?.deviceId;
    // } else {
    //     selectedMic = this.mics[0]?.deviceId;
    // }

    const constraints = { audio: { deviceId: selected ? { exact: selected } : undefined } };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.ctx = this.$.canvas.getContext('2d');
    this.onStream(stream);
    this.createDecibelMeter();
  },
  aWeighting: function (frequency) {
    const f = frequency / 1000;
    const f2 = Math.pow(f, 2);
    const f4 = Math.pow(f, 4);
    const f8 = Math.pow(f, 8);

    let aWeighted;

    if (f < 0.5) {
      aWeighted = -122.02 + 20 * Math.log10(f) + 0.17 * Math.pow((0.5 - f), 2);
    } else if (f >= 0.5 && f < 1) {
      aWeighted = -2.00 - 6.4 * Math.pow((f - 0.5), 2);
    } else if (f >= 1 && f < 2) {
      aWeighted = 0;
    } else if (f >= 2 && f < 4) {
      aWeighted = -2.00 - 0.17 * Math.pow((f - 2), 2);
    } else if (f >= 4 && f < 8) {
      aWeighted = -3.50 - 0.15 * Math.pow((f - 4), 2);
    } else if (f >= 8) {
      aWeighted = -3.50 - 0.22 * Math.pow((f - 8), 2);
    }

    // Add a high-frequency roll-off
    aWeighted -= 0.0006 * f8;

    return aWeighted;
  },
  createDecibelMeter: function () {
    console.log("test");
    //   setInterval(() => {
    //     alert(`Min value: ${this.minValue}, Max value: ${this.maxValue}`);
    //     // Reset min and max values for the next second
    //     minValue = Infinity;
    //     maxValue = -Infinity;
    // }, 5000);


    // Function to update the decibel meter
    var updateDecibelMeter = function () {
      // Get the frequency data
      this.analyser.getByteFrequencyData(this.freq);

      // Calculate the volume in decibels
      var sum = 0;
      for (var i = 0; i < this.freq.length; i++) {
        var frequency = i * this.audioContext.sampleRate / this.analyser.fftSize; // Calculate the frequency of the current bin
        var aWeighted = this.freq[i] + this.aWeighting(frequency); // Apply A-weighting
        sum += Math.pow(10, aWeighted / 10);
      }
      var average = 10 * Math.log10(sum / this.freq.length);
      var volumeInDb = 20 * Math.log10(average);
      // Calibration offset
      var calibrationOffset = 20;

      // Apply the calibration offset
      volumeInDb += calibrationOffset;

      // Update the decibel meter
      let aboutDiv = document.getElementById('about');
      aboutDiv.textContent = `Volume: ${volumeInDb.toFixed(2)} dB`;

      // Call this function again to update the decibel meter
      setTimeout(updateDecibelMeter.bind(this), 100);
    };

    // Start updating the decibel meter
    updateDecibelMeter.call(this);
  },

  onStream: function (stream) {
    console.log("test");
    var input = this.audioContext.createMediaStreamSource(stream);
    var bandpassFilter = this.audioContext.createBiquadFilter();
    bandpassFilter.type = 'bandpass';
    bandpassFilter.frequency.value = 4500; // Center frequency between 20Hz and 9000Hz
    bandpassFilter.Q.value = Math.sqrt((9000 - 20) / 2) / 4500; // Q factor for the given frequency range

    var analyser = this.audioContext.createAnalyser();
    analyser.smoothingTimeConstant = 0;
    analyser.fftSize = this.fftsize;

    // Connect the graph with the bandpass filter.
    input.connect(bandpassFilter);
    bandpassFilter.connect(analyser);

    this.analyser = analyser;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    // this.createDecibelMeter();

    this.render();
  },
  render: function () {
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
    if (this.animate1) {
      requestAnimationFrame(this.render.bind(this));
    }
    var now = new Date();
    if (this.lastRenderTime_) {
      this.instantaneousFPS = now - this.lastRenderTime_;
    }
    this.lastRenderTime_ = now;
  },

  renderTimeDomain: function () {
    var times = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(times);

    for (var i = 0; i < times.length; i++) {
      var value = times[i];
      var percent = value / 256;
      var barHeight = this.height * percent;
      var offset = this.height - barHeight - 1;
      var barWidth = this.width / times.length;
      this.ctx.fillStyle = 'black';
      this.ctx.fillRect(i * barWidth, offset, 1, 1);
    }
  },
// Function to convert frequency to Mel scale
freqToMel: function(freq) {
  return 2595 * Math.log10(1 + freq / 700);
},

// Function to convert Mel scale to frequency
melToFreq: function(mel) {
  return 700 * (10**(mel / 2595) - 1);
},

// Function to scale an index to the Mel scale
melScale: function(index, total) {
  var proportion = index / total;
  var freq = proportion * 22050;
  var mel = this.freqToMel(freq);
  var scaledFreq = this.melToFreq(mel) / 22050 * total;
  return Math.round(scaledFreq);
},

// Your existing renderFreqDomain function, with the Mel scale added
// renderFreqDomain: function () {
//   this.analyser.getByteFrequencyData(this.freq);

//   var ctx = this.ctx;
//   this.tempCanvas.width = this.width;
//   this.tempCanvas.height = this.height;
//   var tempCtx = this.tempCanvas.getContext('2d');
//   tempCtx.drawImage(this.$.canvas, 0, 0, this.width, this.height);

//   for (var i = 0; i < this.freq.length; i++) {
//       var value;
//       if (this.log) {
//           var melIndex = this.melScale(i, this.freq.length);
//           value = this.freq[melIndex];
//       } else {
//           value = this.freq[i];
//       }

//       if (this.log) {
//         logIndex = this.logScale(i, this.freq.length);
//         value = this.freq[logIndex];
//       } else {
//         value = this.freq[i];
//       }

//       ctx.fillStyle = (this.color ? this.getFullColor(value) : this.getGrayColor(value));

//       var percent = i / this.freq.length;
//       var y = Math.round(percent * this.height);

//       // draw the line at the right side of the canvas
//       ctx.fillRect(this.width - this.speed, this.height - y,
//         this.speed, this.speed);
//     }

//     // Translate the canvas.
//     ctx.translate(-this.speed, 0);
//     // Draw the copied image.
//     ctx.drawImage(this.tempCanvas, 0, 0, this.width, this.height,
//       0, 0, this.width, this.height);

//     // Reset the transformation matrix.
//     ctx.setTransform(1, 0, 0, 1, 0, 0);
//   },
renderFreqDomain: function () {
  this.analyser.getByteFrequencyData(this.freq);

  var ctx = this.ctx;
  this.tempCanvas.width = this.width;
  this.tempCanvas.height = this.height;
  var tempCtx = this.tempCanvas.getContext('2d');
  tempCtx.drawImage(this.$.canvas, 0, 0, this.width, this.height);

  var startFreq = 20; // Set start frequency to 20Hz
  var endFreq = 9000; // Set end frequency to 9000Hz
  var startERB = this.freqToERB(startFreq);
  var endERB = this.freqToERB(endFreq);

  // Create an array for the ERB scale
  var erbValues = new Array(this.freq.length).fill(0);
  
  for (var i = 0; i < this.freq.length; i++) {
    var value;
    var erbIndex;
    if (this.log) {
        var freq = this.indexToFreq(i);
        erbIndex = this.freqToERB(freq);
        value = this.freq[i];
        // Fill the ERB scale array
        erbValues[Math.round(erbIndex)] = value;
    } else {
        value = this.freq[i];
    }

    ctx.fillStyle = (this.color ? this.getFullColor(value) : this.getGrayColor(value));

    if (this.log) {
        var percent = (erbIndex - startERB) / (endERB - startERB);
        percent = Math.log10(percent * 9 + 1); // Apply a logarithmic scale
    } else {
        var percent = i / this.freq.length;
    }
    var y = Math.round(percent * this.height);

    // draw the line at the right side of the canvas
    ctx.fillRect(this.width - this.speed, this.height - y,
      this.speed, this.speed);
  }

  // Interpolate the ERB scale array
  erbValues = this.interpolateArray(erbValues, this.freq.length);

  // Translate the canvas.
  ctx.translate(-this.speed, 0);
  // Draw the copied image.
  ctx.drawImage(this.tempCanvas, 0, 0, this.width, this.height,
    0, 0, this.width, this.height);

  // Reset the transformation matrix.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
},
freqToERB: function(f) {
  return 21.4 * Math.log10(4.37 * f / 1000 + 1);
},


  /**
   * Given an index and the total number of entries, return the
   * log-scaled value.
   */
  logScale: function (index, total, opt_base) {
    var base = opt_base || 2;
    var logmax = this.logBase(total + 1, base);
    var exp = logmax * index / total;
    return Math.round(Math.pow(base, exp) - 1);
  },

  logBase: function (val, base) {
    return Math.log(val) / Math.log(base);
  },

  // renderAxesLabels: function () {
  //   if (!this.audioContext) {
  //     return;
  //   }
  //   var canvas = this.$.labels;
  //   canvas.width = this.width;
  //   canvas.height = this.height;
  //   var ctx = canvas.getContext('2d');
  //   var startFreq = 440;
  //   var nyquist = this.audioContext.sampleRate / 2;
  //   var endFreq = nyquist - startFreq;
  //   var step = (endFreq - startFreq) / this.ticks;
  //   var yLabelOffset = 5;
  //   // Render the vertical frequency axis.
  //   for (var i = 0; i <= this.ticks; i++) {
  //     var freq = startFreq + (step * i);
  //     // Get the y coordinate from the current label.
  //     var index = this.freqToIndex(freq);
  //     var percent = index / this.getFFTBinCount();
  //     var y = (1 - percent) * this.height;
  //     var x = this.width - 60;
  //     // Get the value for the current y coordinate.
  //     var label;
  //     if (this.log) {
  //       // Handle a logarithmic scale.
  //       var logIndex = this.logScale(index, this.getFFTBinCount());
  //       // Never show 0 Hz.
  //       freq = Math.max(1, this.indexToFreq(logIndex));
  //     }
  //     var label = this.formatFreq(freq);
  //     var units = this.formatUnits(freq);
  //     ctx.font = '16px Inconsolata';
  //     // Draw the value.
  //     ctx.textAlign = 'right';
  //     ctx.fillText(label, x, y + yLabelOffset);
  //     // Draw the units.
  //     ctx.textAlign = 'left';
  //     ctx.fillText(units, x + 10, y + yLabelOffset);
  //     // Draw a tick mark.
  //     ctx.fillRect(x + 40, y, 30, 2);
  //   }
  // },
  renderAxesLabels: function () {
    if (!this.audioContext) {
        return;
    }
    var canvas = this.$.labels;
    canvas.width = this.width;
    canvas.height = this.height;
    var ctx = canvas.getContext('2d');
    var startFreq = 20; // Set start frequency to 20Hz
    var endFreq = 9000; // Set end frequency to 9000Hz
    var startERB = this.freqToERB(startFreq);
    var endERB = this.freqToERB(endFreq);
    var step = (endERB - startERB) / this.ticks;
    var yLabelOffset = 5;
    // Render the vertical frequency axis.
    for (var i = 0; i <= this.ticks; i++) {
        var erb = startERB + (step * i);
        var freq = this.erbToFreq(erb);
        // Get the y coordinate from the current label.
        var percent = (erb - startERB) / (endERB - startERB);
        var y = (1 - percent) * this.height;
        var x = this.width - 60;
        // Get the value for the current y coordinate.
        var label = this.formatFreq(freq*.8);
        var units = this.formatUnits(freq*.8);
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
erbToFreq: function(e) {
  return (Math.pow(10, e / 21.4) - 1) / 4 * 1000;
},
// erbToFreq: function(e) {
//   return (Math.pow(10, e / 21.4) - 1) / 4.37 * 1000;
// },
interpolateArray: function (data, newLength) {
  var linearInterpolate = function (before, after, atPoint) {
    return before + (after - before) * atPoint;
  };

  var newData = new Array();
  var springFactor = new Number((data.length - 1) / (newLength - 1));
  newData[0] = data[0]; // for new allocation
  for (var i = 1; i < newLength - 1; i++) {
    var tmp = i * springFactor;
    var before = new Number(Math.floor(tmp)).toFixed();
    var after = new Number(Math.ceil(tmp)).toFixed();
    var atPoint = tmp - before;
    newData[i] = linearInterpolate(data[before], data[after], atPoint);
  }
  newData[newLength - 1] = data[data.length - 1]; // for new allocation
  return newData;
},



  clearAxesLabels: function () {
    var canvas = this.$.labels;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, this.width, this.height);
  },

  formatFreq: function (freq) {
    return (freq >= 1000 ? (freq / 1000).toFixed(1) : Math.round(freq));
  },

  formatUnits: function (freq) {
    return (freq >= 1000 ? 'KHz' : 'Hz');
  },

  indexToFreq: function (index) {
    var nyquist = this.audioContext.sampleRate / 2;
    return nyquist / this.getFFTBinCount() * index;
  },

  freqToIndex: function (frequency) {
    var nyquist = this.audioContext.sampleRate / 2;
    return Math.round(frequency / nyquist * this.getFFTBinCount());
  },

  getFFTBinCount: function () {
    return this.fftsize / 2;
  },

  onStream: function (stream) {
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

  onStreamError: function (e) {
    console.error(e);
  },

  getGrayColor: function (value) {
    return 'rgb(V, V, V)'.replace(/V/g, 255 - value);
  },

  getFullColor: function (value) {
    // Clamp value to range 0-255
    value = Math.max(0, Math.min(255, value));

    var fromH = 99;
    var toH = 0;
    var minInput = 0;
    var maxInput = 255;
    var percent = (value - minInput) / (maxInput - minInput);
    var delta = percent * (toH - fromH);
    var hue = fromH + delta;
    return 'hsl(H, 100%, 50%)'.replace(/H/g, hue);
},
  logChanged: function () {
    if (this.labels) {
      this.renderAxesLabels();
    }
  },
  ticksChanged: function () {
    if (this.labels) {
      this.renderAxesLabels();
    }
  },

  labelsChanged: function () {
    if (this.labels) {
      this.renderAxesLabels();
    } else {
      this.clearAxesLabels();
    }
  }
});