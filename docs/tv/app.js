'use strict';
/* REDVUE TV browsing interface: accessible, remote-friendly and catalog-driven.
   Cinemeta supplies discovery metadata. Stremio handles playback. */
(function () {
  const BASE = 'https://v3-cinemeta.strem.io';
  const shelves = [
    {key:'popular-movies',title:'Popular Films',type:'movie',catalog:'top'},
    {key:'popular-shows',title:'Binge-Worthy Series',type:'series',catalog:'top'},
    {key:'new-films',title:'New Films · 2026',type:'movie',catalog:'year',genre:'2026'},
    {key:'new-series',title:'New Series · 2026',type:'series',catalog:'year',genre:'2026'},
    {key:'action',title:'Action & Adventure',type:'movie',catalog:'top',genre:'Action'},
    {key:'crime',title:'Crime & Thrillers',type:'movie',catalog:'top',genre:'Crime'},
    {key:'scifi',title:'Mind-Bending Sci-Fi',type:'movie',catalog:'top',genre:'Sci-Fi'},
    {key:'top-films',title:'Highest-Rated Films',type:'movie',catalog:'imdbRating'},
    {key:'top-shows',title:'Acclaimed TV',type:'series',catalog:'imdbRating'},
    {key:'mystery',title:'Mystery Series',type:'series',catalog:'top',genre:'Mystery'},
    {key:'comedy',title:'Comedy Films',type:'movie',catalog:'top',genre:'Comedy'},
    {key:'drama',title:'Drama Series',type:'series',catalog:'top',genre:'Drama'},
    {key:'horror',title:'Horror Films',type:'movie',catalog:'top',genre:'Horror'},
    {key:'animation',title:'Animated Adventures',type:'movie',catalog:'top',genre:'Animation'},
    {key:'documentary',title:'Documentaries',type:'movie',catalog:'top',genre:'Documentary'},
    {key:'family',title:'Family Film Night',type:'movie',catalog:'top',genre:'Family'},
    {key:'fantasy',title:'Fantasy Series',type:'series',catalog:'top',genre:'Fantasy'},
    {key:'romance',title:'Romance Films',type:'movie',catalog:'top',genre:'Romance'}
  ];
  const qs = (selector) => document.querySelector(selector);
  const doc = document;
  let focusBeforeModal = null;
  let selectedItem = null;
  let searchToken = 0;
  let timer = null;
  const cache = new Map();
  const safeArt = (url) => (typeof url === 'string' && /^https:\/\//i.test(url) ? url : '');
  const poster = (item) => safeArt(item.poster) || ('https://images.metahub.space/poster/medium/' + item.id + '/img');
  const normalize = (item, type) => {
    if (!item || !/^tt\d{5,}$/.test(item.id || '')) return null;
    return {id:item.id,type:type,name:item.name || 'Untitled',poster:item.poster || '',background:item.background || '',description:item.description || '',year:item.releaseInfo || '',rating:item.imdbRating || ''};
  };
  function catalogUrl(shelf, skip, search) {
    const args = [];
    if (shelf.genre) args.push('genre=' + encodeURIComponent(shelf.genre));
    if (search) args.push('search=' + encodeURIComponent(search));
    if (skip) args.push('skip=' + skip);
    return BASE + '/catalog/' + shelf.type + '/' + shelf.catalog + (args.length ? '/' + args.join('&') : '') + '.json';
  }
  async function json(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {signal:controller.signal});
      if (!response.ok) throw Error('Catalog request failed (' + response.status + ')');
      return await response.json();
    } finally {clearTimeout(timeout);}
  }
  function tile(item) {
    const button = doc.createElement('button');
    button.type='button';
    button.className='tile';
    button.setAttribute('aria-label',item.name + ', ' + (item.type === 'movie'?'film':'series'));
    button.dataset.id=item.id; button.dataset.type=item.type;
    const img=doc.createElement('img');img.src=poster(item);img.alt='';img.loading='lazy';
    img.onerror=()=>{img.removeAttribute('src');img.style.opacity='.1';};
    const name=doc.createElement('span');name.className='tile-name';name.textContent=item.name;
    button.append(img,name);
    button.addEventListener('click',()=>showDetails(item));
    return button;
  }
  function showSkeleton(row) {
    row.rail.replaceChildren();
    for(let i=0;i<7;i++){const block=doc.createElement('div');block.className='skeleton';row.rail.append(block);}
  }
  function addMore(row) {
    if (!row.loaded) return;
    const end=Math.min(row.rendered+18,row.items.length);
    const frag=doc.createDocumentFragment();
    for (let i=row.rendered;i<end;i++) frag.append(tile(row.items[i]));
    row.rail.append(frag);
    row.rendered=end;
    row.count.textContent=row.items.length+'+ titles';
  }
  async function fetchNext(row) {
    if(row.loading || !row.hasMore) return;
    row.loading=true;
    try {
      const data=await json(catalogUrl(row, row.skip));
      const incoming=(data.metas || []).map(item=>normalize(item,row.type)).filter(Boolean);
      const oldIds=new Set(row.items.map(item=>item.id));
      row.items.push(...incoming.filter(item=>!oldIds.has(item.id)));
      row.skip += (data.metas || []).length;
      row.hasMore=(data.metas || []).length>=100;
      row.loaded=true;
      if(row.items.length===0) row.rail.textContent='No titles available right now.';
      else { if(row.rendered===0) row.rail.replaceChildren(); addMore(row); }
      if(row.key==='popular-movies' && row.items.length) setHero(row.items[0]);
    } catch(error) {
      row.loaded=true;
      if(!row.items.length) {
        row.rail.replaceChildren();
        const msg=doc.createElement('div');msg.className='error';
        msg.textContent='Could not load live titles. Check your connection or try again.';
        const retry=doc.createElement('button');retry.className='secondary';retry.textContent='Retry';
        retry.addEventListener('click',()=>{showSkeleton(row);row.hasMore=true;fetchNext(row);});
        row.rail.append(msg,retry);
      }
      console.warn('REDVUE catalog unavailable:',row.key,error);
    } finally {row.loading=false;}
  }
  function load(row){if(!row.loaded && !row.loading)fetchNext(row);}
  function makeShelf(row,index) {
    const section=doc.createElement('section');section.className='shelf';section.dataset.row=index;
    const head=doc.createElement('div');head.className='shelf-head';
    const h=doc.createElement('h2');h.textContent=row.title;
    const count=doc.createElement('span');count.className='counter';count.textContent='Browse';
    head.append(h,count);
    const wrap=doc.createElement('div');wrap.className='rail-wrap';
    const rail=doc.createElement('div');rail.className='rail';rail.setAttribute('aria-label',row.title);
    const prev=doc.createElement('button');prev.className='rail-arrow prev';prev.textContent='‹';prev.setAttribute('aria-label','Scroll '+row.title+' left');
    const next=doc.createElement('button');next.className='rail-arrow next';next.textContent='›';next.setAttribute('aria-label','Scroll '+row.title+' right');
    prev.addEventListener('click',()=>rail.scrollBy({left:-rail.clientWidth*.82,behavior:'smooth'}));
    next.addEventListener('click',()=>{rail.scrollBy({left:rail.clientWidth*.82,behavior:'smooth'});maybeExpand(row);});
    rail.addEventListener('scroll',()=>maybeExpand(row),{passive:true});
    wrap.append(rail,prev,next);section.append(head,wrap);
    row.el=section;row.rail=rail;row.count=count;row.items=[];row.rendered=0;row.skip=0;row.loading=false;row.loaded=false;row.hasMore=true;
    showSkeleton(row);return section;
  }
  function maybeExpand(row){
    if(!row.loaded || row.loading)return;
    if(row.rail.scrollLeft+row.rail.clientWidth >= row.rail.scrollWidth-600) {
      if(row.rendered<row.items.length) addMore(row);
      else if(row.hasMore)fetchNext(row);
    }
  }
  function applyFilter(type) {
    shelves.forEach((row)=>{row.el.classList.toggle('hidden-by-filter',type!=='all' && row.type!==type);});
    doc.querySelectorAll('.nav-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.filter===type));
    if(type!=='all')qs('#shelves').scrollIntoView({block:'start',behavior:'smooth'});
  }
  function setHero(item){
    if(!item)return;
    selectedItem=item;
    qs('#hero-title').textContent=item.name;
    qs('#hero-description').textContent='A world of great films and series awaits. Browse our collections and choose what to watch.';
    const art=safeArt(item.background);
    if(art) qs('#hero-art').style.backgroundImage='url(' + JSON.stringify(art) + ')';
    qs('#hero-detail').textContent='Explore ' + item.name;
    // Some catalog previews omit landscape images. Load the detailed backdrop.
    json(BASE+'/meta/'+item.type+'/'+encodeURIComponent(item.id)+'.json').then(data=>{
      if(!selectedItem || selectedItem.id!==item.id)return;
      const meta=data.meta||{};
      const backdrop=safeArt(meta.background||meta.poster);
      if(backdrop)qs('#hero-art').style.backgroundImage='url('+JSON.stringify(backdrop)+')';
      if(meta.description)qs('#hero-description').textContent=meta.description;
    }).catch(()=>{});
  }
  async function showDetails(item) {
    focusBeforeModal=doc.activeElement;
    const overlay=qs('#details-overlay');
    overlay.classList.remove('hidden');overlay.setAttribute('aria-hidden','false');
    qs('#detail-title').textContent=item.name;
    qs('#detail-facts').textContent=item.type==='movie'?'Film':'Series';
    qs('#detail-description').textContent='Loading title information…';
    qs('#detail-hero').style.backgroundImage='none';
    const open=qs('#detail-launch');
    open.href='stremio:///detail/'+item.type+'/'+encodeURIComponent(item.id)+(item.type==='movie'?'/'+encodeURIComponent(item.id):'');
    qs('.detail-close').focus();
    try{
      const data=await json(BASE+'/meta/'+item.type+'/'+encodeURIComponent(item.id)+'.json');
      const meta=data.meta || {};
      if(overlay.classList.contains('hidden')||qs('#detail-title').textContent!==item.name)return;
      qs('#detail-description').textContent=meta.description||item.description||'Explore this title in Stremio.';
      qs('#detail-facts').textContent=[item.type==='movie'?'Film':'Series',meta.releaseInfo||item.year,meta.imdbRating?('IMDb '+meta.imdbRating):''].filter(Boolean).join(' · ');
      const art=safeArt(meta.background||item.background||meta.poster||item.poster);
      if(art)qs('#detail-hero').style.backgroundImage='linear-gradient(0deg,#18181d,transparent 75%),url('+JSON.stringify(art)+')';
    }catch{qs('#detail-description').textContent=item.description||'Explore this title in Stremio.';}
  }
  function closeOverlays(){
    doc.querySelectorAll('.overlay').forEach(el=>{el.classList.add('hidden');el.setAttribute('aria-hidden','true');});
    if(focusBeforeModal && focusBeforeModal.isConnected)focusBeforeModal.focus();
  }
  function showSearch(){
    focusBeforeModal=doc.activeElement;
    qs('#search-overlay').classList.remove('hidden');qs('#search-overlay').setAttribute('aria-hidden','false');
    qs('#search-input').focus();
  }
  async function runSearch(query) {
    const results=qs('#search-results'),status=qs('#search-status');
    const token=++searchToken;
    if(query.trim().length<2){results.replaceChildren();status.textContent='Enter at least 2 characters.';return;}
    status.textContent='Searching movies and series…';
    const items=await Promise.allSettled(['movie','series'].map(async(type)=>{
      const data=await json(catalogUrl({type,catalog:'top'},0,query.trim()));
      return (data.metas||[]).map(item=>normalize(item,type)).filter(Boolean);
    }));
    if(token!==searchToken)return;
    const combined=items.flatMap(r=>r.status==='fulfilled'?r.value:[]);
    const seen=new Set();
    const unique=combined.filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true;});
    results.replaceChildren(...unique.slice(0,90).map(tile));
    status.textContent=unique.length ? unique.length+' matches' : 'No results found, or the catalog is temporarily unavailable.';
  }
  function handleRemote(event) {
    const key=event.key;
    if(key==='Escape'||key==='BrowserBack'||key==='GoBack'||key==='Backspace' && event.target.tagName!=='INPUT'){
      if(doc.querySelector('.overlay:not(.hidden)')){event.preventDefault();closeOverlays();return;}
    }
    if(doc.querySelector('.overlay:not(.hidden)'))return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key))return;
    const active=doc.activeElement;
    if(!active.classList.contains('tile')||!active.closest('.shelf')){
      // A TV remote can enter the rails directly from the top navigation or hero.
      if(key==='ArrowDown'){
        const first=shelves.find(row=>!row.el.classList.contains('hidden-by-filter'));
        if(first){
          event.preventDefault();
          load(first);
          const focusFirst=()=>{const tile=first.rail.querySelector('.tile');if(tile){tile.focus();tile.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});}};
          if(first.rendered)focusFirst();else setTimeout(focusFirst,600);
        }
      }
      return;
    }
    const section=active.closest('.shelf'),current=shelves[Number(section.dataset.row)];
    const cards=[...current.rail.querySelectorAll('.tile')],position=cards.indexOf(active);
    if(position<0)return;
    event.preventDefault();
    if(key==='ArrowLeft'||key==='ArrowRight') {
      const next=position+(key==='ArrowRight'?1:-1);
      if(next>=cards.length && current.rendered<current.items.length)addMore(current);
      const target=current.rail.querySelectorAll('.tile')[next];
      if(target){target.focus();target.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});}
      else if(key==='ArrowRight' && current.hasMore)fetchNext(current);
      return;
    }
    const delta=key==='ArrowDown'?1:-1;
    let idx=Number(section.dataset.row)+delta;
    while(idx>=0 && idx<shelves.length && shelves[idx].el.classList.contains('hidden-by-filter'))idx+=delta;
    if(idx<0){qs('#hero-detail').focus();return;}
    if(idx>=shelves.length)return;
    const targetRow=shelves[idx];load(targetRow);
    const focusTo=()=>{const target=targetRow.rail.querySelectorAll('.tile')[Math.min(position,targetRow.rendered-1)] || targetRow.rail.querySelector('.tile');if(target){target.focus();target.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});}};
    if(targetRow.rendered)focusTo();else setTimeout(focusTo,500);
  }
  function init(){
    const area=qs('#shelves');
    shelves.forEach((row,i)=>area.append(makeShelf(row,i)));
    const watcher='IntersectionObserver' in window ? new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){const row=shelves[Number(entry.target.dataset.row)];load(row);}}),{rootMargin:'650px 0px'}) : null;
    shelves.forEach((row,i)=>{if(i<3)load(row);if(watcher)watcher.observe(row.el);else load(row);});
    doc.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>applyFilter(btn.dataset.filter)));
    qs('#hero-detail').addEventListener('click',()=>selectedItem?showDetails(selectedItem):qs('#shelves').scrollIntoView());
    qs('#hero-explore').addEventListener('click',()=>{qs('#shelves').scrollIntoView({behavior:'smooth'});setTimeout(()=>{const first=qs('.shelf .tile');if(first)first.focus();},400);});
    qs('#search-open').addEventListener('click',showSearch);
    doc.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',closeOverlays));
    doc.querySelectorAll('.overlay').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)closeOverlays();}));
    qs('#search-input').addEventListener('input',e=>{clearTimeout(timer);timer=setTimeout(()=>runSearch(e.target.value),350);});
    doc.addEventListener('keydown',handleRemote);
  }
  init();
})();
