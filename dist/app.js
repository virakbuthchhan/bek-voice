let voiceRecorder=null,referenceUrl=null,recordedUrl=null,shownRecording=null;
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
let mode='tts', style='A warm, gentle young woman speaking naturally', reference=null, engine={state:'offline'}, busy=false, current=null, db;
let engineChoice=localStorage.getItem('sori-engine')||'browser';
const browserEngine=new BrowserVoiceEngine(renderEngine);
const localHost=['127.0.0.1','localhost'].includes(location.hostname), API=localHost?location.origin:null;
const samples={story:'At the edge of a quiet village, where the rice fields met the morning mist, a young girl discovered that the smallest voices often tell the most extraordinary stories.',welcome:'Hello, and welcome. We’re so glad you’re here. Take a breath, make yourself comfortable, and let’s create something wonderful together.',khmer:'សួស្តី! សូមស្វាគមន៍មកកាន់ស្ទូឌីយោសំឡេងរបស់យើង។ ប្រែក្លាយអត្ថបទរបស់អ្នកទៅជាសំឡេងដ៏ធម្មជាតិ ហើយចែករំលែករឿងរ៉ាវរបស់អ្នកជាមួយពិភពលោក។'};
function toast(msg){$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,5500)}
function page(name){if(name!=='studio'&&voiceRecorder?.isBusy)voiceRecorder.cancel();$$('.page').forEach(el=>el.hidden=el.id!==name);$$('.nav').forEach(el=>el.classList.toggle('active',el.dataset.page===name));$('#crumb').textContent=({studio:'Voice studio',voices:'My voices',history:'Audio library',settings:'Settings'})[name];location.hash=name;window.scrollTo(0,0);if(name==='settings')checkEngine()}
$$('[data-page]').forEach(el=>el.onclick=()=>page(el.dataset.page)); $('.brand').onclick=()=>page('studio');$('#engineOpen').onclick=()=>page('settings');$('#help').onclick=()=>{page('settings');toast('Start the local engine to generate speech. Your first model download may take a while.')};
function updateText(){const n=$('#script').value.length;$('#charCount').textContent=`${n.toLocaleString()} / 5,000 characters`;try{localStorage.setItem('sori-draft',$('#script').value)}catch{} }
$('#script').oninput=updateText;$('#resetText').onclick=()=>{$('#script').value='';updateText()};$$('[data-sample]').forEach(el=>el.onclick=()=>{$('#script').value=samples[el.dataset.sample];updateText();$('#script').focus()});$('#textFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;const t=await f.text();$('#script').value=t.slice(0,5000);updateText();if(t.length>5000)toast('Imported the first 5,000 characters.')};
$$('.mode').forEach(el=>el.onclick=()=>setMode(el.dataset.mode));function setMode(m){if(m!=='clone'&&voiceRecorder?.isBusy)voiceRecorder.cancel();mode=m;$$('.mode').forEach(el=>{el.classList.toggle('active',el.dataset.mode===m);el.setAttribute('aria-pressed',el.dataset.mode===m)});$('#standardVoice').hidden=m==='clone';$('#cloneVoice').hidden=m!=='clone'}
$$('.voice-choice').forEach(el=>el.onclick=()=>{style=el.dataset.style;$$('.voice-choice').forEach(e=>{e.classList.toggle('selected',e===el);e.setAttribute('aria-pressed',e===el)})});$('#guidance').oninput=()=>$('#guidanceValue').value=Number($('#guidance').value).toFixed(1);
$('#newVoice').onclick=()=>{page('studio');setMode('clone');$('#dropZone').scrollIntoView({behavior:'smooth'})};
function applyReference(blob,name,duration,label=name){
  if(voiceRecorder?.isBusy)voiceRecorder.cancel();
  $('#referencePlayer').pause();if(referenceUrl)URL.revokeObjectURL(referenceUrl);
  reference={blob,name,duration};$('#consent').checked=false;$('#uploadLabel').textContent=label;$('#voiceName').value=name;
  referenceUrl=URL.createObjectURL(blob);$('#referencePlayer').src=referenceUrl;$('#referencePlayer').hidden=false;
}
async function pickReference(file){
  if(!file)return false;if(file.size>15*1024*1024){toast('Choose a WAV file smaller than 15 MB.');return false;}
  let ctx;
  try{ctx=new AudioContext();const buffer=await ctx.decodeAudioData(await file.arrayBuffer());
    if(buffer.duration<3||buffer.duration>30){toast('Use a reference clip between 3 and 30 seconds.');return false;}
    const mono=new Float32Array(buffer.length);for(let c=0;c<buffer.numberOfChannels;c++){const channel=buffer.getChannelData(c);for(let i=0;i<mono.length;i++)mono[i]+=channel[i]/buffer.numberOfChannels;}
    applyReference(encodeWav(mono,buffer.sampleRate),file.name.replace(/\.[^.]+$/,''),buffer.duration,file.name);toast('Reference ready. Confirm permission before cloning.');return true;
  }catch{toast('Could not read this audio. Choose a valid WAV file.');return false;}finally{if(ctx)await ctx.close().catch(()=>{});}
}
function encodeWav(data,rate){const buf=new ArrayBuffer(44+data.length*2),v=new DataView(buf);const str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,36+data.length*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,data.length*2,true);for(let i=0;i<data.length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,data[i]))*32767,true);return new Blob([buf],{type:'audio/wav'})}
$('#voiceFile').onchange=e=>pickReference(e.target.files[0]);$('#dropZone').ondragover=e=>{e.preventDefault();$('#dropZone').style.background='#eaf1de'};$('#dropZone').ondragleave=()=>$('#dropZone').style.background='';$('#dropZone').ondrop=e=>{e.preventDefault();$('#dropZone').style.background='';pickReference(e.dataTransfer.files[0])};
const readingSamples={
  km:'សួស្តី! នេះគឺជាសំឡេងធម្មជាតិរបស់ខ្ញុំ។ ខ្ញុំចូលចិត្តអានរឿងរ៉ាវ និងចែករំលែកគំនិតថ្មីៗ។ ថ្ងៃនេះ ខ្ញុំកំពុងអានអត្ថបទនេះយ៉ាងច្បាស់ និងស្រួលៗ ដើម្បីបង្កើតសំឡេងផ្ទាល់ខ្លួនរបស់ខ្ញុំ។',
  en:'Hello! This is my natural speaking voice. I enjoy telling stories and sharing new ideas. Today, I am reading this short passage clearly and at a comfortable pace to create a voice that sounds like me.'
};
function readingSample(){const language=$('#readingLanguage').value;$('#readingSample').textContent=readingSamples[language];$('#readingSample').lang=language;}
$('#readingLanguage').onchange=readingSample;readingSample();
function referenceMethod(method){
  if(method==='upload'&&voiceRecorder?.isBusy)voiceRecorder.cancel();
  $('#uploadPanel').hidden=method!=='upload';$('#recordPanel').hidden=method!=='record';
  for(const name of ['upload','record']){const selected=name===method;$('#'+name+'Method').classList.toggle('selected',selected);$('#'+name+'Method').setAttribute('aria-pressed',selected);}
}
$('#uploadMethod').onclick=()=>referenceMethod('upload');$('#recordMethod').onclick=()=>referenceMethod('record');
function renderRecording(){
  const r=voiceRecorder;if(!r)return;const working=r.isBusy;
  if($('#recordMessage').textContent!==r.message)$('#recordMessage').textContent=r.message;$('#recordMessage').classList.toggle('error',r.state==='error');
  $('#recordIndicator').classList.toggle('active',r.state==='recording');
  $('#recordTimer').textContent=`00:${String(Math.min(30,Math.floor(r.elapsed))).padStart(2,'0')} / 00:30`;
  $('#startRecording').disabled=working||busy;$('#startRecording').textContent=r.draft?'● Record again':'● Start recording';
  $('#stopRecording').disabled=r.state!=='recording'||r.elapsed<3;$('#cancelRecording').hidden=!working;
  $('#readingLanguage').disabled=working;$('#recordingReview').hidden=!r.draft||working;
  $('#useRecording').disabled=working||busy;$('#discardRecording').disabled=working;$('#saveVoice').disabled=working||busy;
  if(shownRecording!==r.draft?.blob){$('#recordedPlayer').pause();if(recordedUrl)URL.revokeObjectURL(recordedUrl);recordedUrl=null;shownRecording=r.draft?.blob;
    if(r.draft){recordedUrl=URL.createObjectURL(r.draft.blob);$('#recordedPlayer').src=recordedUrl;}else{$('#recordedPlayer').removeAttribute('src');$('#recordedPlayer').load();}}
  $('#generate').disabled=busy||working||engine.state!=='ready';
}
voiceRecorder=new VoiceRecorder({encodeWav,onChange:renderRecording});renderRecording();
$('#startRecording').onclick=()=>{if(busy)return toast('Wait for voice generation to finish first.');$('#referencePlayer').pause();$('#recordedPlayer').pause();voiceRecorder.start();};
$('#stopRecording').onclick=()=>voiceRecorder.stop();$('#cancelRecording').onclick=()=>voiceRecorder.cancel();
$('#discardRecording').onclick=()=>voiceRecorder.discard();
$('#useRecording').onclick=()=>{const draft=voiceRecorder.draft;if(!draft||voiceRecorder.isBusy||busy)return;applyReference(draft.blob,draft.name,draft.duration,'Recorded voice · '+draft.duration.toFixed(1)+'s');toast('Recording selected as your reference. Confirm permission before cloning.');};
window.addEventListener('pagehide',()=>{if(voiceRecorder?.isBusy)voiceRecorder.cancel();});
const openDb=new Promise((resolve,reject)=>{const req=indexedDB.open('sori-studio',1);req.onupgradeneeded=()=>{for(const n of ['voices','clips'])req.result.createObjectStore(n,{keyPath:'id'})};req.onsuccess=()=>{db=req.result;resolve(db)};req.onerror=()=>reject(req.error)});
async function put(store,row){await openDb;return new Promise((res,rej)=>{let tx=db.transaction(store,'readwrite');tx.objectStore(store).put(row);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}async function all(store){await openDb;return new Promise((res,rej)=>{let req=db.transaction(store).objectStore(store).getAll();req.onsuccess=()=>res(req.result.sort((a,b)=>b.created-a.created));req.onerror=()=>rej(req.error)})}async function remove(store,id){await openDb;return new Promise((res,rej)=>{let tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
$('#saveVoice').onclick=async()=>{if(!reference)return toast('Upload a WAV file or record and use a reference voice first.');if(!$('#consent').checked)return toast('Confirm you have permission to use this voice.');try{await put('voices',{...reference,id:crypto.randomUUID(),created:Date.now(),name:$('#voiceName').value.trim()||reference.name});await renderLibrary();toast('Voice saved on this device.')}catch{toast('Could not save the voice. Browser storage may be full.')}};
function empty(parent,title,sub){const div=document.createElement('div');div.className='empty-state';const b=document.createElement('b');b.textContent=title;div.append(b,document.createTextNode(sub));parent.append(div)}
function makeButton(text,cls,fn){const b=document.createElement('button');b.textContent=text;b.className=cls;b.onclick=fn;return b}
async function renderLibrary(){try{const [voices,clips]=await Promise.all([all('voices'),all('clips')]);$('#voiceCount').textContent=voices.length;$('#historyCount').textContent=clips.length;const vl=$('#voiceLibrary');vl.replaceChildren();if(!voices.length)empty(vl,'Your voice belongs here.','Add a short reference clip to get started.');for(const v of voices){const card=document.createElement('article');card.className='panel voice-card';const h=document.createElement('h2');h.textContent=v.name;const sub=document.createElement('small');sub.textContent=`${v.duration.toFixed(1)} seconds · Stored locally`;card.append(h,sub,makeButton('Use this voice ↗','secondary',()=>{applyReference(v.blob,v.name,v.duration);page('studio');setMode('clone')}),makeButton('Remove','text-button',async()=>{await remove('voices',v.id);renderLibrary()}));vl.append(card)}for(const [selector,rows] of [['#recentList',clips.slice(0,3)],['#historyList',clips]]){const list=$(selector);list.replaceChildren();if(!rows.length)empty(list,'A quiet studio, for now.','Your generated audio will appear here.');for(const c of rows){const row=document.createElement('div');row.className='recent-item';const info=document.createElement('div');info.className='clip-info';const b=document.createElement('b');b.textContent=c.text;const small=document.createElement('small');small.textContent=`${c.mode==='clone'?'Cloned voice':'Voice design'} · ${new Date(c.created).toLocaleDateString()} · ${c.duration.toFixed(1)}s`;info.append(b,small);row.append(makeButton('▶','clip-play',()=>{page('studio');showResult(c);$('#result').scrollIntoView({behavior:'smooth'});$('#player').play().catch(()=>{})}),info,makeButton('↓','icon-button',()=>download(c.blob,'sori-speech.wav')),makeButton('↗','icon-button',()=>{$('#script').value=c.text;updateText();page('studio')}),makeButton('×','icon-button',async()=>{await remove('clips',c.id);renderLibrary()}));list.append(row)}}}catch{toast('Browser storage is unavailable. Downloads still work.')}}
function renderEngine(){
  if(engineChoice!=='browser')return;
  engine={state:browserEngine.state};const b=browserEngine;
  $('#generate').disabled=busy||b.state!=='ready'||!!voiceRecorder?.isBusy;$('#generate').title=b.state==='ready'?'Generate speech on your device':b.state==='busy'?'Generating speech on your device…':'Set up or load the browser model first';
  if(voiceRecorder)renderRecording();
  const top=({ready:'Browser model ready',loading:'Preparing browser model…',busy:'Generating on your GPU…',error:'Model needs attention'})[b.state]||'Browser AI · WebGPU';
  $('#statusTop').textContent=top;$('.engine-status').classList.toggle('ready',b.state==='ready');
  $('#deviceCheck').textContent=b.supported===false?'WebGPU not available':b.supported?(b.state==='ready'?'● Model is ready on this device':'● Your device supports WebGPU'):'Checking your device…';
  $('#deviceCheck').classList.toggle('unsupported',b.supported===false);
  $('#modelMessage').textContent=b.message;$('#engineDetail').textContent=b.message;
  const loading=b.state==='loading',ready=b.state==='ready',working=loading||b.state==='busy';
  const label=b.state==='busy'?'◌ Generating on your GPU…':ready?'✓ Model ready':loading?(b.stage==='compile'?'Preparing on GPU…':'Downloading model…'):b.cached?'↻ Load saved model':'↓ Set up · ≈1.9 GB download';
  for(const id of ['#studioLoadModel','#loadModel']){$(id).textContent=label;$(id).disabled=working||ready||b.supported===false;}
  $('#modelProgressWrap').hidden=!loading;$('#cancelModel').hidden=!loading;
  const percent=b.total>0?Math.min(100,b.loaded/b.total*100):0;$('#modelProgress').value=percent;
  $('#modelProgressText').textContent=b.stage==='compile'?`Preparing graph ${b.loaded} / ${b.total}`:`${(b.loaded/1e9).toFixed(2)} / ${(b.total/1e9).toFixed(2)} GB`;
  $('#modelPercent').textContent=Math.floor(percent)+'%';
}
async function checkEngine(){
  if(engineChoice==='browser'){renderEngine();return;}
  if(!API){engine={state:'offline'};$('#statusTop').textContent='Python service required';$('#engineDetail').textContent='Open the app through the included Python service.';return;}
  try{const res=await fetch(API+'/api/status',{signal:AbortSignal.timeout(3000)});engine=await res.json();$('#statusTop').textContent=({ready:'Python engine ready',loading:'Loading Python model…',idle:'Python service connected',error:'Model needs attention',busy:'Generating locally…'})[engine.state]||'Engine connected';$('.engine-status').classList.toggle('ready',engine.state==='ready');$('#engineDetail').textContent=engine.message||engine.state;$('#loadModel').disabled=['loading','ready','busy'].includes(engine.state);$('#loadModel').textContent=engine.state==='ready'?'✓ Python model loaded':engine.state==='loading'?'Loading model…':'↓ Load Python model · ≈5 GB';}catch{engine={state:'offline'};$('#statusTop').textContent='Python engine offline';$('#engineDetail').textContent='Run ./start-python.sh in the downloaded project.';}
}
async function loadSelectedModel(){
  if(engineChoice==='browser'){try{await browserEngine.load();toast('Browser model ready. You can now generate speech.');}catch(e){if(e.code!=='CANCELLED')toast(e.message);}return;}
  if(!API)return toast('Open the local app at http://127.0.0.1:8765 for the Python engine.');
  try{const r=await fetch(API+'/api/load',{method:'POST'});const data=await r.json();if(!r.ok)throw Error(data.error);toast('Python model setup started.');checkEngine();}catch(e){toast(e.message);}
}
$('#engineChoice').value=engineChoice;
function applyEngineChoice(){const browserMode=engineChoice==='browser';$('#deviceCard').hidden=!browserMode;$('#pythonInstructions').hidden=browserMode;$('#setupExplanation').textContent=browserMode?'Download the compact 4-bit model once. Speech and cloning run in your browser on WebGPU.':'Run the included Python service. The original model downloads about 5 GB and supports MPS, CUDA, or CPU.';checkEngine();}
$('#engineChoice').onchange=()=>{if(busy||browserEngine.state==='loading'){toast('Cancel the current operation before switching engines.');$('#engineChoice').value=engineChoice;return;}engineChoice=$('#engineChoice').value;localStorage.setItem('sori-engine',engineChoice);applyEngineChoice();};
$('#checkEngine').onclick=async()=>{if(engineChoice==='browser')await browserEngine.checkDevice();checkEngine();};
$('#loadModel').onclick=loadSelectedModel;$('#studioLoadModel').onclick=loadSelectedModel;$('#modelSettings').onclick=()=>page('settings');
$('#cancelModel').onclick=()=>browserEngine.cancel();$('#cancelGeneration').onclick=()=>browserEngine.cancel();
applyEngineChoice();browserEngine.checkDevice();
function base64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(blob)})}
$('#generate').onclick=async()=>{
  if(busy)return;if(voiceRecorder?.isBusy)return toast('Finish or cancel your recording first.');const text=$('#script').value.trim(),generationMode=mode;
  if(!text)return toast('Add a script or try one of the samples.');
  if(mode==='clone'&&(!reference||!$('#consent').checked))return toast('Add a reference voice and confirm permission to clone it.');
  await checkEngine();if(engine.state!=='ready'){if(engineChoice==='browser'){$('#deviceCard').scrollIntoView({behavior:'smooth',block:'center'});toast('Set up or load the browser model first.');}else{page('settings');toast('Load the Python model first.');}return;}
  busy=true;$('#generate').disabled=true;$('#cancelGeneration').hidden=engineChoice!=='browser';$('#generate').textContent='◌ Generating on your device…';
  try{
    const language=$('#language').value;const languageDirection=language==='auto'?'':'Speaking in '+$('#language').selectedOptions[0].textContent.split(' · ')[0];const directions=[mode==='tts'?style:'',languageDirection,$('#direction').value.trim()].filter(Boolean).join(', ');const seedValue=$('#seed').value;const seed=seedValue===''?undefined:Number(seedValue);
    let blob;
    if(engineChoice==='browser'){
      let voice={kind:'design',description:directions};
      if(mode==='clone'){const ctx=new AudioContext();const decoded=await ctx.decodeAudioData(await reference.blob.arrayBuffer());await ctx.close();const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000);const source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();const resampled=await offline.startRendering();voice={kind:'clone',style:directions,reference:{pcm16k:resampled.getChannelData(0),transcript:''}};}
      const pcm=await browserEngine.synthesize(text,voice,{cfg:Number($('#guidance').value),steps:Number($('#steps').value),...(seed!==undefined?{seed}:{})},message=>$('#generate').textContent='◌ '+message);blob=encodeWav(pcm,48000);
    }else{
      const body={text,style:directions,guidance:Number($('#guidance').value),steps:Number($('#steps').value),seed:seed??null,reference:mode==='clone'?await base64(reference.blob):null,consent:mode==='clone'?$('#consent').checked:false};
      const res=await fetch(API+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!res.ok){const err=await res.json();throw Error(err.error||'Generation failed');}blob=await res.blob();
    }
    const context=new AudioContext();const decoded=await context.decodeAudioData(await blob.arrayBuffer());const clip={id:crypto.randomUUID(),created:Date.now(),text,mode:generationMode,blob,duration:decoded.duration};await context.close();await showResult(clip);
    try{await put('clips',clip);await renderLibrary();}catch{toast('Audio generated. Download it now; browser storage is full.');}
    $('#result').scrollIntoView({behavior:'smooth',block:'center'});$('#player').play().catch(()=>{});
  }catch(e){toast(e.message||'Generation failed. Check the selected engine.');}finally{busy=false;$('#generate').disabled=false;$('#cancelGeneration').hidden=true;$('#generate').innerHTML='✧ Generate speech <span>↗</span>';checkEngine();}
};
async function showResult(clip){current=clip;$('#result').hidden=false;if(showResult.url)URL.revokeObjectURL(showResult.url);showResult.url=URL.createObjectURL(clip.blob);$('#player').src=showResult.url;$('#downloadWav').href=showResult.url;try{const ctx=new AudioContext();const audio=await ctx.decodeAudioData(await clip.blob.arrayBuffer());const samples=audio.getChannelData(0),wave=$('#waveform');wave.replaceChildren();for(let n=0;n<100;n++){let peak=0;const start=Math.floor(n*samples.length/100),end=Math.floor((n+1)*samples.length/100);for(let i=start;i<end;i+=Math.max(1,Math.floor((end-start)/100)))peak=Math.max(peak,Math.abs(samples[i]));const el=document.createElement('i');el.style.height=Math.max(2,peak*65)+'px';wave.append(el)}await ctx.close()}catch{}}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function timecode(t){const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`}
$('#downloadSrt').onclick=()=>{if(!current)return;const parts=current.text.match(/[^.!?។\n]+[.!?។]?/g)||[current.text];const total=parts.reduce((n,p)=>n+p.length,0);let elapsed=0;const srt=parts.map((p,i)=>{const start=elapsed;elapsed+=current.duration*p.length/total;return `${i+1}\n${timecode(start)} --> ${timecode(elapsed)}\n${p.trim()}\n`}).join('\n');download(new Blob([srt],{type:'text/plain;charset=utf-8'}),'sori-estimated.srt')};
for(let i=0;i<31;i++){const b=document.createElement('i');b.style.height=(12+Math.sin(i/30*Math.PI)**2*(35+Math.sin(i*1.7)**2*60))+'px';$('#heroWave').append(b)}
try{$('#script').value=localStorage.getItem('sori-draft')||''}catch{}updateText();renderLibrary();checkEngine();setInterval(()=>{if(!busy)checkEngine()},5000);if(['studio','voices','history','settings'].includes(location.hash.slice(1)))page(location.hash.slice(1));
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));
