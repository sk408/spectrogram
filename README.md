A live-input spectrogram written using [Polymer][polymer] using the [Web
Audio API][wapi].

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
