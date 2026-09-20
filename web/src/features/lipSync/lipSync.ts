export class LipSync {
  public readonly analyser: AnalyserNode;
  public readonly recording: MediaStreamAudioDestinationNode;
  private readonly data = new Float32Array(2048);
  private source?: AudioBufferSourceNode;
  private generation = 0;
  constructor(public readonly audio: AudioContext) {
    this.analyser = audio.createAnalyser();
    this.recording = audio.createMediaStreamDestination();
  }
  update() {
    this.analyser.getFloatTimeDomainData(this.data);
    let peak = 0;
    for (const value of this.data) peak = Math.max(peak, Math.abs(value));
    const volume = 1 / (1 + Math.exp(-45 * peak + 5));
    return { volume: volume < 0.1 ? 0 : volume };
  }
  stop() {
    this.generation++;
    this.source?.stop();
    this.source = undefined;
  }
  async playFromArrayBuffer(buffer: ArrayBuffer, onEnded?: () => void) {
    const generation = this.generation;
    await this.audio.resume();
    const decoded = await this.audio.decodeAudioData(buffer);
    if (generation !== this.generation) {
      onEnded?.();
      return;
    }
    await new Promise<void>((resolve) => {
      const source = this.audio.createBufferSource();
      this.source = source;
      source.buffer = decoded;
      source.connect(this.audio.destination);
      source.connect(this.analyser);
      source.connect(this.recording);
      source.onended = () => {
        source.disconnect();
        if (this.source === source) this.source = undefined;
        onEnded?.();
        resolve();
      };
      source.start();
    });
  }
  async playFromURL(url: string, onEnded?: () => void) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Audio download failed');
    await this.playFromArrayBuffer(await response.arrayBuffer(), onEnded);
  }
}
