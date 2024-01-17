A live-input spectrogram written using [Polymer][polymer] using the [Web
Audio API][wapi].

![Screenshot](screenshot.png)

[See it in action][demo]. Once running, see if you can make a pattern
with your speech or by whistling. You can also click anywhere on the
page to turn on the oscillator. For a bit more fun, [load this][aphex]
in a parallel tab.

[aphex]: https://www.youtube.com/watch?v=M9xMuPWAZW8&t=5m30s
[polymer]: http://polymer-project.org
[wapi]: http://webaudioapi.com
[demo]: http://borismus.github.io/spectrogram

<!--more-->

# Why?

Having a spectrogram is incredibly handy for a lot of the work I've done
recently. So a while ago, I built one that satisfies my needs. It runs
in a full-screen, using the microphone input as the source.

![Latency estimation](latency.png)

# Configuration parameters

The following are HTML attributes of the `g-spectrogram` component. Many
of them are also configurable via the spectrogram controls component,
which shows up if the `controls` attribute is set to true.

- `controls` (boolean): shows a config UI component.
- `log` (boolean): enables y-log scale (linear by default).
- `speed` (number): how many pixels to move past for every frame.
- `labels` (boolean): enables y-axis labels.
- `ticks` (number): how many y labels to show.
- `color` (boolean): turns on color mode (grayscale by default).


# Using the Polymer component

Simplest possible version:

    <g-spectrogram/>

Enable controls:

    <g-spectrogram controls>
    </g-spectrogram>

Pass parameters to the component:

    <g-spectrogram log labels ticks="10">
    </g-spectrogram>


# Future work / features

It would be great to add a few things to this tool. If you're interested
in contributing, submit your changes as a pull request [on
github][github]. Some ideas for things that can be done:

- Improved axis labeling.
- Make it work in mobile browsers.
- Loading/saving of traces.
- Loading audio data from a file.
- Zoom support.
- Higher precision FFT results (would require writing a custom FFT
  rather than using the one built into Web Audio API.)

[github]: https://github.com/borismus/spectrogram
