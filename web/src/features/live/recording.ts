/** Capture chosen screen plus the exact audio used for lip sync (no duplicate tab audio). */
export class ScreenRecording {
  private recorder: MediaRecorder;
  private chunks: Blob[] = [];
  private finished: Promise<Blob>;
  constructor(
    private screen: MediaStream,
    audio: MediaStream,
    onEnded: () => void,
    onError: () => void,
  ) {
    const stream = new MediaStream([...screen.getVideoTracks(), ...audio.getAudioTracks()]);
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    this.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    this.finished = new Promise((resolve) => {
      this.recorder.ondataavailable = (event) => {
        if (event.data.size) this.chunks.push(event.data);
      };
      this.recorder.onstop = () => {
        this.screen.getTracks().forEach((track) => track.stop());
        resolve(new Blob(this.chunks, { type: this.recorder.mimeType }));
        this.chunks = [];
      };
    });
    this.recorder.onerror = onError;
    screen.getVideoTracks()[0].addEventListener('ended', onEnded, { once: true });
    this.recorder.start(1000);
  }
  async stop() {
    if (this.recorder.state !== 'inactive') this.recorder.stop();
    return this.finished;
  }
}
