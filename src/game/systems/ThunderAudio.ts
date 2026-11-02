/** Bounded WebAudio voices using the weather system's existing noise buffer.
 * A sharp crack, several rolling rumbles and a descending bass tail share its
 * mute/visibility bus. No new audio context, download or gameplay timer. */
export class ThunderAudio {
  private readonly voices=new Map<AudioScheduledSourceNode,()=>void>();
  play(audio:AudioContext,bus:AudioNode,noise:AudioBuffer,distant:boolean){
    if(this.voices.size>=12)return;
    const now=audio.currentTime,level=distant?.62:1;
    const layer=(delay:number,duration:number,frequency:number,volume:number,crack=false)=>{
      const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
      source.buffer=noise;source.loop=true;source.playbackRate.value=.7+Math.random()*.4;
      filter.type=crack?'bandpass':'lowpass';filter.Q.value=.7;
      filter.frequency.setValueAtTime(frequency,now+delay);
      filter.frequency.exponentialRampToValueAtTime(Math.max(45,frequency*.25),now+delay+duration);
      const start=now+delay;
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume*level,start+(crack?.008:.12));
      gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      source.connect(filter).connect(gain).connect(bus);
      const release=()=>{this.voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};
      this.voices.set(source,release);source.onended=release;
      source.start(start,Math.random()*noise.duration);source.stop(start+duration+.02);
    };
    if(!distant)layer(0,.23,2100,1.7,true);
    layer(distant?.12:.025,2.1,750,distant?2.8:3.4);
    layer(.4,5.3,260,4.2);layer(1.4,5.8,150,3.1);
    const bass=audio.createOscillator(),gain=audio.createGain();
    bass.type='sine';bass.frequency.setValueAtTime(52,now);bass.frequency.exponentialRampToValueAtTime(24,now+3.8);
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.12*level,now+.12);
    gain.gain.exponentialRampToValueAtTime(.0001,now+4);
    bass.connect(gain).connect(bus);
    const release=()=>{this.voices.delete(bass);bass.disconnect();gain.disconnect();};
    this.voices.set(bass,release);bass.onended=release;bass.start(now);bass.stop(now+4.02);
  }
  destroy(){for(const [source,release] of this.voices){source.onended=null;source.stop();release();}this.voices.clear();}
}
