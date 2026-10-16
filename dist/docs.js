/* In-app guide: searchable topics, deep links, and copyable setup commands. */
(function(){
  const articles=[...document.querySelectorAll('[data-doc-article]')];
  const nav=[...document.querySelectorAll('[data-doc]')],navContainer=document.getElementById('docsNav');
  const search=document.getElementById('docsSearch'),results=document.getElementById('docsSearchResults'),status=document.getElementById('docsSearchStatus'),reading=document.getElementById('docsArticles');
  function show(id){
    if(!articles.some(article=>article.dataset.docArticle===id))id='quick-start';
    search.value='';navContainer.hidden=false;results.hidden=true;status.hidden=true;reading.hidden=false;
    for(const article of articles)article.hidden=article.dataset.docArticle!==id;
    for(const button of nav){if(button.dataset.doc===id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
    return id;
  }
  function go(id){if(location.hash==='#docs/'+id)show(id);else location.hash='docs/'+id;}
  nav.forEach(button=>button.onclick=()=>go(button.dataset.doc));
  function filter(){
    const query=search.value.trim().toLocaleLowerCase();results.replaceChildren();results.hidden=!query;status.hidden=!query;reading.hidden=!!query;navContainer.hidden=!!query;
    if(!query)return;
    const words=query.split(/\s+/u),matches=articles.filter(article=>words.every(word=>article.textContent.toLocaleLowerCase().includes(word)));
    status.textContent=matches.length?`${matches.length} matching ${matches.length===1?'topic':'topics'}`:'No matching topics. Try “model”, “Python”, or “recording”.';
    for(const article of matches){const button=document.createElement('button');button.className='docs-search-result';const title=document.createElement('strong');title.textContent=article.querySelector('h2').textContent;const description=document.createElement('span');const excerpt=[...article.querySelectorAll('p,li,td,code')].find(el=>words.some(word=>el.textContent.toLocaleLowerCase().includes(word)))?.textContent||article.querySelector('p')?.textContent||'Open this guide topic.';const clean=excerpt.replace(/\s+/gu,' ').trim();description.textContent=clean.length>210?clean.slice(0,210)+'…':clean;button.append(title,description);button.onclick=()=>go(article.dataset.docArticle);results.append(button);}
  }
  search.oninput=filter;search.onkeydown=event=>{if(event.key==='Escape'){search.value='';filter();}};
  for(const pre of document.querySelectorAll('#docs pre')){
    const button=document.createElement('button');button.type='button';button.className='docs-copy';button.textContent='Copy';button.setAttribute('aria-label','Copy command');
    button.onclick=async()=>{try{await navigator.clipboard.writeText(pre.querySelector('code').textContent);button.textContent='Copied';button.setAttribute('aria-label','Command copied');}catch{button.textContent='Select text to copy';}setTimeout(()=>{button.textContent='Copy';button.setAttribute('aria-label','Copy command');},2500);};
    pre.append(button);
  }
  window.BekDocs={show};
})();
