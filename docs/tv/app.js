'use strict';
/* REDVUE TV browsing interface: accessible, remote-friendly and catalog-driven.
   Cinemeta supplies discovery metadata. Stremio handles playback. */
(function () {
  const BASE = 'https://v3-cinemeta.strem.io';
  const TMDB_API = typeof window.REDVUE_TMDB_API === 'string' && /^https:\/\//i.test(window.REDVUE_TMDB_API)
    ? window.REDVUE_TMDB_API.replace(/\/+$/, '') : '';
  const USING_TMDB = Boolean(TMDB_API);
  const shelves = USING_TMDB ? [
    {key:'trending-movies',title:'🔥 Trending Movies This Week',type:'movie'},
    {key:'trending-series',title:'📺 Trending Series This Week',type:'series'},
    {key:'popular-movies',title:'Popular Right Now',type:'movie'},
    {key:'popular-series',title:'Binge-Worthy Series',type:'series'},
    {key:'now-playing',title:'Now Playing in Cinemas',type:'movie'},
    {key:'top-movies',title:'All-Time Great Films',type:'movie'},
    {key:'top-series',title:'Top-Rated Series',type:'series'},
    {key:'action',title:'Action & Adventure',type:'movie'},
    {key:'sci-fi',title:'Out of This World Sci-Fi',type:'movie'},
    {key:'crime-movies',title:'Crime & Thrillers',type:'movie'},
    {key:'drama-series',title:'Gripping Drama Series',type:'series'},
    {key:'horror',title:'Horror After Dark',type:'movie'},
    {key:'comedy-movies',title:'Comedy Favourites',type:'movie'},
    {key:'mystery-series',title:'Mystery & Suspense',type:'series'},
    {key:'animation',title:'Animated Adventures',type:'movie'},
    {key:'documentaries',title:'Real Stories & Documentaries',type:'movie'},
    {key:'scifi-series',title:'Sci-Fi & Fantasy Series',type:'series'},
    {key:'upcoming',title:'Coming Soon',type:'movie'},
    {key:'family',title:'Family Movie Night',type:'movie'},
    {key:'crime-series',title:'Crime Series',type:'series'},
    {key:'thriller',title:'Edge-of-Your-Seat Thrillers',type:'movie'},
    {key:'romance',title:'Love Stories',type:'movie'},
    {key:'documentary-series',title:'Fascinating Docuseries',type:'series'},
    {key:'comedy-series',title:'Comedy Series',type:'series'},
    {key:'animation-series',title:'Animated Series',type:'series'},
    {key:'fantasy',title:'Fantasy & Magic',type:'movie'},
    {key:'adventure',title:'Adventure Awaits',type:'movie'},
    {key:'airing-today',title:'On TV Today',type:'series'},
    {key:'reality-series',title:'Reality TV',type:'series'},
    {key:'trending-today',title:'Trending Today',type:'movie'}
  ] : [
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
  const poster = (item) => safeArt(item.poster) || (USING_TMDB ? '' : ('https://images.metahub.space/poster/medium/' + item.id + '/img'));
  const normalize = (item, type) => {
    if(USING_TMDB) {
      if(!item || !Number.isSafeInteger(item.tmdbId) || !['movie','series'].includes(item.type))return null;
      return {id:item.id,tmdbId:item.tmdbId,type:item.type,name:item.name||'Untitled',poster:item.poster||'',background:item.background||'',description:item.description||'',year:item.year||'',rating:item.rating||null};
    }
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
      const data=await json(USING_TMDB
        ? TMDB_API+'/catalog/'+encodeURIComponent(row.key)+'?page='+row.page
        : catalogUrl(row,row.skip));
      const metas=USING_TMDB ? (data.results || []) : (data.metas || []);
      const incoming=metas.map(item=>normalize(item,row.type)).filter(Boolean);
      const oldIds=new Set(row.items.map(item=>item.id));
      row.items.push(...incoming.filter(item=>!oldIds.has(item.id)));
      if(USING_TMDB) {
        row.page=(data.page || row.page)+1;
        row.hasMore=(data.page || 1)<(data.total_pages || 1);
      } else {
        row.skip += metas.length;
        row.hasMore=metas.length>=100;
      }
      row.loaded=true;
      if(row.items.length===0) {
        row.rail.replaceChildren();
        row.rail.textContent='No titles available right now.';
      } else {
        if(row.rendered===0)row.rail.replaceChildren();
        addMore(row);
      }
      if(row.key===(USING_TMDB?'trending-movies':'popular-movies') && row.items.length && !selectedItem)setHero(row.items[0]);
    } catch(error) {
      row.loaded=true;
      if(!row.items.length){
        row.rail.replaceChildren();
        const msg=doc.createElement('div');msg.className='error';
        msg.textContent='Could not load titles. Check the REDVUE API or your connection.';
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
    row.el=section;row.rail=rail;row.count=count;row.items=[];row.rendered=0;row.skip=0;row.page=1;row.loading=false;row.loaded=false;row.hasMore=true;
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
    qs('#hero-description').textContent=item.description||'Discover films and series worth watching.';
    const art=safeArt(item.background);
    if(art)qs('#hero-art').style.backgroundImage='url('+JSON.stringify(art)+')';
    qs('#hero-detail').textContent='Explore '+item.name;
    // Cinemeta previews often omit a backdrop; use detail metadata when available.
    const path=USING_TMDB
      ? TMDB_API+'/details/'+item.type+'/'+item.tmdbId
      : BASE+'/meta/'+item.type+'/'+encodeURIComponent(item.id)+'.json';
    json(path).then(data=>{
      if(!selectedItem||selectedItem.id!==item.id)return;
      const meta=USING_TMDB ? data : (data.meta || {});
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
    qs('#detail-description').textContent=item.description||'Loading title information…';
    qs('#detail-hero').style.backgroundImage='none';
    const open=qs('#detail-launch');
    open.removeAttribute('href');
    open.removeAttribute('target');
    open.textContent='Finding Stremio link…';
    open.classList.add('unavailable');
    qs('.detail-close').focus();
    try {
      const path=USING_TMDB
        ? TMDB_API+'/details/'+item.type+'/'+item.tmdbId
        : BASE+'/meta/'+item.type+'/'+encodeURIComponent(item.id)+'.json';
      const data=await json(path);
      const meta=USING_TMDB ? data : (data.meta||{});
      if(overlay.classList.contains('hidden')||qs('#detail-title').textContent!==item.name)return;
      qs('#detail-description').textContent=meta.description||item.description||'Explore this title in Stremio.';
      qs('#detail-facts').textContent=[item.type==='movie'?'Film':'Series',meta.year||meta.releaseInfo||item.year,meta.rating?('TMDB '+meta.rating):'',meta.imdbRating?('IMDb '+meta.imdbRating):'',...(Array.isArray(meta.genres)?meta.genres.slice(0,2):[])].filter(Boolean).join(' · ');
      const art=safeArt(meta.background||item.background||meta.poster||item.poster);
      if(art)qs('#detail-hero').style.backgroundImage='linear-gradient(0deg,#18181d,transparent 75%),url('+JSON.stringify(art)+')';
      const imdbId=USING_TMDB ? meta.imdbId : item.id;
      if(/^tt\d+$/.test(imdbId||'')){
        open.href='stremio:///detail/'+item.type+'/'+encodeURIComponent(imdbId)+(item.type==='movie'?'/'+encodeURIComponent(imdbId):'');
        open.textContent='▶ Open in Stremio';
        open.classList.remove('unavailable');
      }else if(USING_TMDB){
        open.href='https://www.themoviedb.org/'+(item.type==='series'?'tv':'movie')+'/'+item.tmdbId;
        open.target='_blank';
        open.rel='noopener noreferrer';
        open.textContent='View on TMDB (Stremio ID unavailable)';
        open.classList.remove('unavailable');
      }
    }catch{
      qs('#detail-description').textContent=item.description||'Details could not be loaded.';
      if(!USING_TMDB && /^tt\d+$/.test(item.id)){
        open.href='stremio:///detail/'+item.type+'/'+encodeURIComponent(item.id)+(item.type==='movie'?'/'+encodeURIComponent(item.id):'');
        open.textContent='▶ Open in Stremio';
        open.classList.remove('unavailable');
      }else{
        open.textContent='Unable to resolve Stremio link';
      }
    }
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
    try {
      let combined;
      if(USING_TMDB) {
        const data=await json(TMDB_API+'/search?q='+encodeURIComponent(query.trim()));
        combined=(data.results||[]).map(item=>normalize(item,item.type)).filter(Boolean);
      }else{
        const items=await Promise.allSettled(['movie','series'].map(async(type)=>{
          const data=await json(catalogUrl({type,catalog:'top'},0,query.trim()));
          return (data.metas||[]).map(item=>normalize(item,type)).filter(Boolean);
        }));
        combined=items.flatMap(r=>r.status==='fulfilled'?r.value:[]);
      }
      if(token!==searchToken)return;
      const seen=new Set();
      const unique=combined.filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true;});
      results.replaceChildren(...unique.slice(0,90).map(tile));
      status.textContent=unique.length ? unique.length+' matching titles' : 'No results found.';
    }catch{
      if(token!==searchToken)return;
      results.replaceChildren();
      status.textContent='Search is unavailable. Please try again.';
    }
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
    const provider=qs('#provider-credit');
    const status=qs('#source-status');
    if(provider)provider.hidden=!USING_TMDB;
    if(status)status.textContent=USING_TMDB?'Live catalogue: TMDB':'Catalogue: Cinemeta (TMDB not connected yet)';
    const area=qs('#shelves');
    shelves.forEach((row,i)=>area.append(makeShelf(row,i)));
    // Expose only the safe lazy-loader to the Android TV remote controller.
    // It needs to request a row even when the row is outside the viewport.
    window.REDVUE_TV_DATA = {
      loadRow(index) {
        const row = shelves[index];
        if (row) load(row);
      }
    };
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
