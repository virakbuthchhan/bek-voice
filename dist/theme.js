/* Apply before CSS paints; a saved preference overrides the OS appearance. */
(function(){
  const key='bek-theme',system=window.matchMedia('(prefers-color-scheme: dark)');
  let preference='system';
  try{const saved=localStorage.getItem(key);if(['light','dark'].includes(saved))preference=saved;}catch{}
  function apply(){
    const dark=preference==='dark'||(preference==='system'&&system.matches);
    document.documentElement.dataset.theme=dark?'dark':'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#171a17':'#f7f6f2');
    const toggle=document.getElementById('themeToggle');
    if(toggle){toggle.setAttribute('aria-pressed',String(dark));toggle.title=dark?'Switch to light theme':'Switch to dark theme';}
    const select=document.getElementById('themePreference');if(select)select.value=preference;
  }
  function set(value){
    if(!['system','light','dark'].includes(value))return;
    preference=value;
    try{if(value==='system')localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}
    apply();
  }
  apply();system.addEventListener('change',()=>{if(preference==='system')apply();});
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null){preference=['light','dark'].includes(event.newValue)?event.newValue:'system';apply();}});
  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('themeToggle').onclick=()=>set(document.documentElement.dataset.theme==='dark'?'light':'dark');
    document.getElementById('themePreference').onchange=event=>set(event.target.value);
    apply();
  });
})();
