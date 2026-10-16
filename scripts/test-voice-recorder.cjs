const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
vm.runInThisContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/voice-recorder.js'),'utf8'));
let now=0,tick;
Object.defineProperty(globalThis,'isSecureContext',{value:true,configurable:true});
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia(){}}},configurable:true});
Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
globalThis.setInterval=callback=>(tick=callback,1);
globalThis.clearInterval=()=>{tick=null;};
globalThis.MediaRecorder=class {
 static isTypeSupported(){return true;}
 constructor(){this.state='inactive';this.mimeType='audio/webm';}
 start(){this.state='recording';}
 stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['audio'])});this.onstop?.();});}
};
function stream(){const track={readyState:'live',stop(){this.readyState='ended';}};return {track,getTracks:()=>[track],getAudioTracks:()=>[track]};}
function buffer(seconds=4,silent=false){return {length:Math.round(seconds*16000),sampleRate:16000,numberOfChannels:1,getChannelData:()=>new Float32Array(Math.round(seconds*16000)).fill(silent?0:.1)};}
function recorder(options={}){return new VoiceRecorder({encodeWav:()=>new Blob(['wav']),decode:async()=>buffer(),...options});}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('recording validation and microphone cleanup',async t=>{
 await t.test('permission denial is actionable',async()=>{const r=recorder({capture:async()=>{throw Object.assign(Error(),{name:'NotAllowedError'});}});await r.start();assert.equal(r.state,'error');assert.match(r.message,/denied/);assert.equal(r.isBusy,false);});
 await t.test('cancellation while permission is pending stops a late stream',async()=>{let grant;const source=stream();const r=recorder({capture:()=>new Promise(resolve=>grant=resolve)});const pending=r.start();r.cancel();grant(source);await pending;assert.equal(source.track.readyState,'ended');assert.equal(r.state,'idle');});
 await t.test('stop is gated at 3 seconds and valid audio becomes a draft',async()=>{now=0;const source=stream();const r=recorder({capture:async()=>source});await r.start();now=1000;r.stop();assert.equal(r.state,'recording');now=4000;r.stop();assert.equal(source.track.readyState,'ended');await settle();assert.equal(r.state,'ready');assert.equal(r.draft.duration,4);});
 await t.test('automatic 30-second stop trims encoder padding',async()=>{now=0;const source=stream();const r=recorder({capture:async()=>source,decode:async()=>buffer(30.1)});await r.start();now=30100;tick();await settle();assert.equal(r.state,'ready');assert.equal(r.draft.duration,30);assert.equal(source.track.readyState,'ended');});
 await t.test('silent and short recordings are rejected',async()=>{for(const decoded of [buffer(1),buffer(4,true)]){const r=recorder({capture:async()=>stream(),decode:async()=>decoded});await r.start();now+=4000;r.stop();await settle();assert.equal(r.state,'error');assert.equal(r.draft,null);}});
 await t.test('cancelled audio processing cannot resurrect a draft',async()=>{let resolve;const r=recorder({capture:async()=>stream(),decode:()=>new Promise(r=>resolve=r)});await r.start();now+=4000;r.stop();await settle();r.cancel();resolve(buffer());await settle();assert.equal(r.state,'idle');assert.equal(r.draft,null);});
 await t.test('discard removes the draft',async()=>{const r=recorder();r.draft={blob:new Blob(),duration:4};r.discard();assert.equal(r.draft,null);assert.equal(r.state,'idle');});
});
