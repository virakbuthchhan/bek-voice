let voiceRecorder=null,referenceUrl=null,recordedUrl=null,shownRecording=null;
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
let mode='tts', style='A warm, gentle young woman speaking naturally', reference=null, engine={state:'offline'}, busy=false, current=null, db;
let activeBatch=null,viewBatch=null,runOptions=null,stopRequested=false,partUrls=[];
let engineChoice=localStorage.getItem('sori-engine')||'browser';
const browserEngine=new BrowserVoiceEngine(renderEngine);
const localHost=['127.0.0.1','localhost'].includes(location.hostname), API=localHost?location.origin:null;
const samples={story:'At the edge of a quiet village, where the rice fields met the morning mist, a young girl discovered that the smallest voices often tell the most extraordinary stories.',welcome:'Hello, and welcome. We’re so glad you’re here. Take a breath, make yourself comfortable, and let’s create something wonderful together.',khmer:'សួស្តី! សូមស្វាគមន៍មកកាន់ស្ទូឌីយោសំឡេងរបស់យើង។ ប្រែក្លាយអត្ថបទរបស់អ្នកទៅជាសំឡេងដ៏ធម្មជាតិ ហើយចែករំលែករឿងរ៉ាវរបស់អ្នកជាមួយពិភពលោក។'};
function toast(msg){$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,5500)}
function page(name){if(name!=='studio'&&voiceRecorder?.isBusy)voiceRecorder.cancel();$$('.page').forEach(el=>el.hidden=el.id!==name);$$('.nav').forEach(el=>{const active=el.dataset.page===name;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});$('#crumb').textContent=({studio:'Studio',voices:'My voices',history:'Audio library',settings:'Settings'})[name];location.hash=name;window.scrollTo(0,0);if(name==='settings')checkEngine()}
$$('[data-page]').forEach(el=>el.onclick=()=>page(el.dataset.page)); $('.brand').onclick=()=>page('studio');$('#engineOpen').onclick=()=>page('settings');$('#help').onclick=()=>{page('settings');toast('Set up your local engine once, then create speech right here on your device.')};
function updateText(){const n=$('#script').value.length;$('#charCount').textContent=`${n.toLocaleString()} / 5,000 characters`;const count=SpeechParts.splitText($('#script').value).length;$('#splitHint').textContent=count>1?`This script will generate as ${count} short parts. Listen as they finish, then merge into one WAV.`:'Long scripts split automatically. Listen to each part or merge them when ready.';try{localStorage.setItem('sori-draft',$('#script').value);$('#draftStatus').textContent='Auto-saved locally'}catch{$('#draftStatus').textContent='Local saving unavailable'} }
$('#script').oninput=updateText;$('#resetText').onclick=()=>{$('#script').value='';updateText()};$$('[data-sample]').forEach(el=>el.onclick=()=>{$('#script').value=samples[el.dataset.sample];updateText();$('#script').focus()});$('#textFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;const t=await f.text();$('#script').value=t.slice(0,5000);updateText();if(t.length>5000)toast('Imported the first 5,000 characters.')};
$$('.mode').forEach(el=>el.onclick=()=>setMode(el.dataset.mode));function setMode(m){if(m!=='clone'&&voiceRecorder?.isBusy)voiceRecorder.cancel();mode=m;document.body.dataset.mode=m;$$('.mode').forEach(el=>{el.classList.toggle('active',el.dataset.mode===m);el.setAttribute('aria-pressed',el.dataset.mode===m)});$('#standardVoice').hidden=m==='clone';$('#cloneVoice').hidden=m!=='clone'}
$$('.voice-choice').forEach(el=>el.onclick=()=>{style=el.dataset.style;$$('.voice-choice').forEach(e=>{e.classList.toggle('selected',e===el);e.setAttribute('aria-pressed',e===el)})});$('#guidance').oninput=()=>$('#guidanceValue').value=Number($('#guidance').value).toFixed(1);
$('#newVoice').onclick=()=>{page('studio');setMode('clone');$('#cloneVoice').scrollIntoView({behavior:'smooth',block:'center'})};
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
function makeButton(text,cls,fn){const b=document.createElement('button');b.textContent=text;b.className=cls;b.onclick=fn;const label=({'▶':'Play audio','↓':'Download audio','↗':'Reuse script','×':'Remove audio'})[text];if(label){b.setAttribute('aria-label',label);b.title=label;}return b}
async function renderLibrary(){try{const [voices,clips]=await Promise.all([all('voices'),all('clips')]);$('#voiceCount').textContent=voices.length;$('#historyCount').textContent=clips.length;const vl=$('#voiceLibrary');vl.replaceChildren();if(!voices.length)empty(vl,'Your voice belongs here.','Add a short reference clip to get started.');for(const v of voices){const card=document.createElement('article');card.className='panel voice-card';const h=document.createElement('h2');h.textContent=v.name;const sub=document.createElement('small');sub.textContent=`${v.duration.toFixed(1)} seconds · Stored locally`;card.append(h,sub,makeButton('Use this voice ↗','secondary',()=>{applyReference(v.blob,v.name,v.duration);page('studio');setMode('clone')}),makeButton('Remove','text-button',async()=>{await remove('voices',v.id);renderLibrary()}));vl.append(card)}for(const [selector,rows] of [['#recentList',clips.slice(0,3)],['#historyList',clips]]){const list=$(selector);list.replaceChildren();if(!rows.length)empty(list,'A quiet studio, for now.','Your generated audio will appear here.');for(const c of rows){const row=document.createElement('div');row.className='recent-item';const info=document.createElement('div');info.className='clip-info';const b=document.createElement('b');b.textContent=c.text;const small=document.createElement('small');small.textContent=`${c.mode==='clone'?'Cloned voice':'Voice design'} · ${new Date(c.created).toLocaleDateString()} · ${c.duration.toFixed(1)}s${c.parts?' · '+c.parts.filter(p=>p.blob).length+'/'+c.parts.length+' parts':''}`;info.append(b,small);row.append(makeButton('▶','clip-play',()=>{page('studio');if(c.parts){showBatch(c);$('#partsPanel').scrollIntoView({behavior:'smooth'});}else{showResult(c);$('#result').scrollIntoView({behavior:'smooth'});$('#player').play().catch(()=>{});}}),info,makeButton('↓','icon-button',()=>{if(c.blob)download(c.blob,'bek-speech.wav');else{page('studio');showBatch(c);$('#partsPanel').scrollIntoView({behavior:'smooth'});toast('Download a part below, or merge completed parts.');}}),makeButton('↗','icon-button',()=>{$('#script').value=c.text;updateText();page('studio')}),makeButton('×','icon-button',async()=>{if(busy&&c.id===activeBatch?.id)return toast('Wait for generation to finish before removing it.');await remove('clips',c.id);renderLibrary()}));list.append(row)}}}catch{toast('Browser storage is unavailable. Downloads still work.')}}
function renderEngine(){
  if(engineChoice!=='browser')return;
  engine={state:browserEngine.state};const b=browserEngine;document.body.dataset.engine=b.state;
  $('#generate').disabled=busy||b.state!=='ready'||!!voiceRecorder?.isBusy;$('#generate').title=b.state==='ready'?'Generate speech on your device':b.state==='busy'?'Generating speech on your device…':'Set up or load the browser model first';
  if(voiceRecorder)renderRecording();
  const top=({ready:'Browser model ready',loading:'Preparing browser model…',busy:'Generating on your GPU…',error:'Model needs attention'})[b.state]||'Browser AI · WebGPU';
  $('#statusTop').textContent=top;$('.engine-status').classList.toggle('ready',b.state==='ready');
  $('#deviceCheck').textContent=b.supported===false?'WebGPU not available':b.supported?(b.state==='ready'?'● Model is ready on this device':'● Your device supports WebGPU'):'Checking your device…';
  $('#deviceCheck').classList.toggle('unsupported',b.supported===false);
  $('#modelMessage').textContent=b.message;$('#engineDetail').textContent=b.message;
  const loading=b.state==='loading',ready=b.state==='ready',working=loading||b.state==='busy';
  const label=b.state==='busy'?'Generating…':ready?'✓ Model ready':loading?(b.stage==='compile'?'Preparing…':'Downloading…'):b.cached?'Load saved model':'Set up · 1.9 GB';
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
  renderRecording();
}
async function loadSelectedModel(){
  if(engineChoice==='browser'){try{await browserEngine.load();toast('Browser model ready. You can now generate speech.');}catch(e){if(e.code!=='CANCELLED')toast(e.message);}return;}
  if(!API)return toast('Open the local app at http://127.0.0.1:8765 for the Python engine.');
  try{const r=await fetch(API+'/api/load',{method:'POST'});const data=await r.json();if(!r.ok)throw Error(data.error);toast('Python model setup started.');checkEngine();}catch(e){toast(e.message);}
}
$('#engineChoice').value=engineChoice;
function applyEngineChoice(){const browserMode=engineChoice==='browser';$('#deviceCard').hidden=!browserMode;if(!browserMode)delete document.body.dataset.engine;$('#pythonInstructions').hidden=browserMode;$('#setupExplanation').textContent=browserMode?'Download the compact 4-bit model once. Speech and cloning run in your browser on WebGPU.':'Run the included Python service. The original model downloads about 5 GB and supports MPS, CUDA, or CPU.';checkEngine();}
$('#engineChoice').onchange=()=>{if(busy||browserEngine.state==='loading'){toast('Cancel the current operation before switching engines.');$('#engineChoice').value=engineChoice;return;}engineChoice=$('#engineChoice').value;localStorage.setItem('sori-engine',engineChoice);applyEngineChoice();};
$('#checkEngine').onclick=async()=>{if(engineChoice==='browser')await browserEngine.checkDevice();checkEngine();};
$('#loadModel').onclick=loadSelectedModel;$('#studioLoadModel').onclick=loadSelectedModel;$('#modelSettings').onclick=()=>page('settings');
$('#cancelModel').onclick=()=>browserEngine.cancel();$('#cancelGeneration').onclick=()=>{stopRequested=true;$('#cancelGeneration').disabled=true;$('#cancelGeneration').textContent='Stopping after this part…';renderParts();};
applyEngineChoice();browserEngine.checkDevice();
function base64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(blob)})}
function showBatch(batch){
  viewBatch=activeBatch?.id===batch.id?activeBatch:batch;
  partUrls.forEach(url=>URL.revokeObjectURL(url));partUrls=[];$('#partsList').replaceChildren();
  $('#partsPanel').hidden=false;$('#result').hidden=true;$('#player').pause();
  renderParts();
  if(viewBatch.blob)showResult({...viewBatch,text:viewBatch.parts.filter(p=>p.blob).map(p=>p.text).join(' ')});
}
function renderParts(){
  const batch=viewBatch;if(!batch)return;
  const done=batch.parts.filter(p=>p.blob),running=batch.parts.find(p=>p.status==='running');
  const isActive=busy&&activeBatch?.id===batch.id;
  $('#partsCount').textContent=`${done.length} / ${batch.parts.length} ready`;
  $('#partsProgress').max=batch.parts.length;$('#partsProgress').value=done.length;
  $('#partsStatus').textContent=isActive?(stopRequested?'Finishing the current part, then stopping…':running?`Generating part ${batch.parts.indexOf(running)+1} of ${batch.parts.length}…`:'Preparing your voice…'):batch.status==='complete'?'All parts are ready. Listen below or merge into one WAV.':batch.status==='error'?`Generation paused: ${batch.error}`:'Stopped. Your completed parts are ready below.';
  const elapsed=running?Math.floor((Date.now()-running.started)/1000):0;
  $('#partsDetail').textContent=isActive?`${done.length} completed · ${running?elapsed+'s on this part · ':''}Each part becomes playable when it finishes.`:`${done.length} completed · ${batch.duration.toFixed(1)}s of audio · ${batch.storageWarning?'Download before leaving this page':'Saved on this device'}${done.length<batch.parts.length?' · Merge exports completed parts only.':'.'}`;
  $('#mergeParts').disabled=busy||!done.length;$('#mergeParts').textContent=done.length===batch.parts.length?'Merge all parts':'Merge completed parts';
  $('#continueParts').hidden=busy||activeBatch?.id!==batch.id||!runOptions||batch.status==='complete';
  for(const [index,part] of batch.parts.entries()){
    let row=$('#partsList').children[index];
    if(!row){row=document.createElement('li');row.className='speech-part';const head=document.createElement('div');head.className='part-heading';const title=document.createElement('b');title.textContent=`Part ${index+1}`;const status=document.createElement('span');status.className='part-state';head.append(title,status);const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='View text';const text=document.createElement('p');text.textContent=part.text;details.append(summary,text);row.append(head,details);$('#partsList').append(row);}
    row.dataset.status=part.status;row.querySelector('.part-state').textContent=part.blob?`Ready · ${part.duration.toFixed(1)}s`:part.status==='running'?`Generating · ${elapsed}s`:part.status==='error'?'Needs retry':'Waiting';
    if(part.blob&&!row.querySelector('audio')){const url=URL.createObjectURL(part.blob);partUrls.push(url);const player=document.createElement('audio');player.controls=true;player.preload='none';player.src=url;player.setAttribute('aria-label',`Play part ${index+1}`);const link=document.createElement('a');link.className='text-button part-download';link.href=url;link.download=`bek-part-${String(index+1).padStart(2,'0')}.wav`;link.textContent='↓ Download part';row.append(player,link);}
  }
}
setInterval(()=>{if(busy&&viewBatch?.id===activeBatch?.id)renderParts();},1000);
async function saveBatch(batch){
  if(!batch.parts.some(p=>p.blob))return;
  try{await put('clips',batch);}catch{if(!batch.storageWarning){batch.storageWarning=true;toast('Browser storage is full. Download completed parts before leaving this page.');}}
}
async function startParts(batch,options){
  if(busy)return;busy=true;stopRequested=false;activeBatch=batch;runOptions=options;
  $('#generate').disabled=true;$('#generate').textContent='Preparing generation…';
  try{
    await checkEngine();if(engine.state!=='ready')throw Error('Load the selected model first in Settings.');
    delete batch.blob;delete batch.mergedParts;batch.status='running';showBatch(batch);$('#partsPanel').scrollIntoView({behavior:'smooth',block:'start'});
    $('#cancelGeneration').hidden=false;$('#cancelGeneration').disabled=false;$('#cancelGeneration').textContent='Stop after this part';
    let voice=options.voice;
    if(options.engine==='browser'&&!voice){
      voice={kind:'design',description:options.directions};
      if(options.reference){let ctx;let decoded;try{ctx=new AudioContext();decoded=await ctx.decodeAudioData(await options.reference.arrayBuffer());}finally{await ctx?.close();}const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000);const source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();const resampled=await offline.startRendering();voice={kind:'clone',style:options.directions,reference:{pcm16k:resampled.getChannelData(0),transcript:''}};}
      options.voice=voice;
    }
    if(options.engine==='python'&&options.reference&&!options.referenceBase64)options.referenceBase64=await base64(options.reference);
    await SpeechParts.run(batch,async(text,index)=>{
      $('#generate').textContent=`Generating part ${index+1} / ${batch.parts.length}…`;
      if(options.engine==='browser')return encodeWav(await browserEngine.synthesize(text,voice,options.settings),48000);
      const body={text,style:options.directions,guidance:options.settings.cfg,steps:options.settings.steps,seed:options.settings.seed??null,reference:options.referenceBase64||null,consent:options.consent};
      const res=await fetch(API+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!res.ok){const err=await res.json();throw Error(err.error||'Generation failed');}return res.blob();
    },{update:()=>{if(viewBatch?.id===batch.id)renderParts();},save:saveBatch,shouldStop:()=>stopRequested});
    if(batch.parts.length===1&&batch.parts[0].blob){batch.blob=batch.parts[0].blob;batch.mergedParts=1;await saveBatch(batch);if(viewBatch?.id===batch.id){await showResult({...batch,text:batch.parts[0].text});$('#player').play().catch(()=>{});}}
    if(batch.status==='complete')toast(batch.parts.length>1?'All parts are ready. Listen individually or merge into one WAV.':'Your audio is ready.');
  }catch(error){batch.status='error';batch.error=error.message;await saveBatch(batch);toast(error.message||'Generation failed. Completed parts are kept.');}
  finally{busy=false;$('#generate').disabled=false;$('#cancelGeneration').hidden=true;$('#generate').textContent='Generate speech →';renderParts();await renderLibrary();await checkEngine();renderRecording();}
}
$('#generate').onclick=()=>{
  if(busy)return;if(voiceRecorder?.isBusy)return toast('Finish or cancel your recording first.');
  const text=$('#script').value.trim();if(!text)return toast('Add a script or try one of the samples.');if(text.length>5000)return toast('Keep the script within 5,000 characters.');
  if(mode==='clone'&&(!reference||!$('#consent').checked))return toast('Add a reference voice and confirm permission to clone it.');
  const language=$('#language').value;const languageDirection=language==='auto'?'':'Speaking in '+$('#language').selectedOptions[0].textContent.split(' · ')[0];
  const directions=[mode==='tts'?style:'',languageDirection,$('#direction').value.trim()].filter(Boolean).join(', ');
  const seedValue=$('#seed').value,seed=seedValue===''?undefined:Number(seedValue);if(seed!==undefined&&(!Number.isInteger(seed)||seed<0||seed>2147483647))return toast('Seed must be a nonnegative 32-bit integer.');
  const batch={id:crypto.randomUUID(),created:Date.now(),text,mode,duration:0,status:'pending',parts:SpeechParts.splitText(text).map(text=>({text,status:'pending'}))};
  startParts(batch,{engine:engineChoice,directions,settings:{cfg:Number($('#guidance').value),steps:Number($('#steps').value),...(seed!==undefined?{seed}:{})},reference:mode==='clone'?reference.blob:null,consent:mode==='clone'&&$('#consent').checked});
};
$('#continueParts').onclick=()=>{if(activeBatch&&runOptions)startParts(activeBatch,runOptions);};
$('#mergeParts').onclick=async()=>{
  const batch=viewBatch;if(!batch||busy)return;
  const button=$('#mergeParts');button.disabled=true;button.textContent='Merging…';
  try{const done=batch.parts.filter(p=>p.blob);const blob=await SpeechParts.mergeWavs(done.map(p=>p.blob));batch.blob=blob;batch.mergedParts=done.length;await saveBatch(batch);await showResult({...batch,text:done.map(p=>p.text).join(' ')});$('#result').scrollIntoView({behavior:'smooth',block:'center'});await renderLibrary();toast(`${done.length} parts merged in order. Your WAV is ready.`);}catch(error){toast(error.message);}finally{renderParts();}
};
async function showResult(clip){current=clip;$('#resultTitle').textContent=clip.parts?.length>1?'Your merged audio is ready.':'Your audio is ready.';$('#result').hidden=false;if(showResult.url)URL.revokeObjectURL(showResult.url);showResult.url=URL.createObjectURL(clip.blob);$('#player').src=showResult.url;$('#downloadWav').href=showResult.url;try{const ctx=new AudioContext();const audio=await ctx.decodeAudioData(await clip.blob.arrayBuffer());const samples=audio.getChannelData(0),wave=$('#waveform');wave.replaceChildren();for(let n=0;n<100;n++){let peak=0;const start=Math.floor(n*samples.length/100),end=Math.floor((n+1)*samples.length/100);for(let i=start;i<end;i+=Math.max(1,Math.floor((end-start)/100)))peak=Math.max(peak,Math.abs(samples[i]));const el=document.createElement('i');el.style.height=Math.max(2,peak*65)+'px';wave.append(el)}await ctx.close()}catch{}}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function timecode(t){const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`}
$('#downloadSrt').onclick=()=>{if(!current)return;const parts=current.text.match(/[^.!?។\n]+[.!?។]?/g)||[current.text];const total=parts.reduce((n,p)=>n+p.length,0);let elapsed=0;const srt=parts.map((p,i)=>{const start=elapsed;elapsed+=current.duration*p.length/total;return `${i+1}\n${timecode(start)} --> ${timecode(elapsed)}\n${p.trim()}\n`}).join('\n');download(new Blob([srt],{type:'text/plain;charset=utf-8'}),'bek-estimated.srt')};
try{$('#script').value=localStorage.getItem('sori-draft')||''}catch{}updateText();renderLibrary();checkEngine();setInterval(()=>{if(!busy)checkEngine()},5000);if(['studio','voices','history','settings'].includes(location.hash.slice(1)))page(location.hash.slice(1));
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));

document.querySelector('.import-label').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('#textFile').click();}});
