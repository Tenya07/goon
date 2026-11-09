/* Uses the existing syllabus/notes documents. No migration and no note content
   in the public source. Drafts are account-scoped and never sent to an AI API. */
const Notebook = (() => {
  const K = NotebookKnowledge;
  const O = typeof NotebookOfficialNotes==='undefined'?{}:NotebookOfficialNotes;
  const state = {mode:'notes', selected:'y1-cs50t:4', noteSource:'mine', editing:false, query:'', course:'all', group:'all', system:'all', branch:'all', node:'html', edge:null, graphQuery:'', zoom:1, panX:0, panY:0};
  const officialScroll=new Map();
  let accountKey = null, drafts = {}, statuses = {}, timer = null, queue = Promise.resolve(), drag = null, positionsCache = new Map(), pendingGraph = null;
  const html = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = s => String(s||'').toLocaleLowerCase();
  const watched = r => !!(mem.courses[r.course] && (sylWatch(r.course)[r.index] || sylDone(r.course)[r.index]));
  const activeNodes = () => K.nodes.filter(n=>n.refs.some(watched));
  function activeEdges(nodes = activeNodes()) {
    const ids = new Set(nodes.map(n=>n.id));
    return K.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)&&e.refs.every(watched));
  }
  function loadDrafts() {
    const key = 'study-notebook-drafts-v2:' + (sess?.email || 'local');
    if(accountKey===key) return;
    accountKey=key; drafts={}; statuses={};
    officialScroll.clear();
    try { drafts=JSON.parse(localStorage.getItem(key)||'{}'); } catch(_) {}
    Object.assign(state,{mode:'notes',selected:'y1-cs50t:4',noteSource:'mine',editing:false,query:'',course:'all',node:'html',edge:null,group:'all',system:'all',branch:'all',graphQuery:''});
    try {const view=JSON.parse(localStorage.getItem(key+':view')||'{}');if(['notes','map','courses'].includes(view.mode))state.mode=view.mode;if(typeof view.selected==='string')state.selected=view.selected;}catch(_){}
  }
  function persistView(){if(!accountKey)return;try{localStorage.setItem(accountKey+':view',JSON.stringify({mode:state.mode,selected:state.selected}));}catch(_) {}}
  function persistDrafts() {
    if(!accountKey)return true;
    try {localStorage.setItem(accountKey,JSON.stringify(drafts)); return true;}
    catch(_) {return false;}
  }
  function records() {
    const out=[];
    for(const [id,c] of bySubj('courses','computer')) {
      const syl=SYLLABI[id]; if(!syl) continue;
      for(let index=0;index<syl.weeks.length;index++) {
        const week=syl.weeks[index];
        out.push({key:`${id}:${index}`,course:id,index,title:week.t,courseName:syl.name,week,
          seen:watched({course:id,index}),text:String(sylNotes(id)[index]||'')});
      }
    }
    for(const [id,n] of bySubj('notes','computer')) out.push({key:`note:${id}`,id,course:'loose',index:null,title:(n.text||'').split('\n')[0].slice(0,58)||'独立笔记',courseName:'独立笔记',text:String(n.text||''),seen:false});
    return out;
  }
  function current() {
    const all=records();
    return all.find(r=>r.key===state.selected)||all.find(r=>r.seen&&r.text)||all.find(r=>r.seen)||all[0]||null;
  }
  function serverText(key) {
    if(key.startsWith('note:')) return String(mem.notes[key.slice(5)]?.text||'');
    const [id,index]=key.split(':'); return String(sylNotes(id)[index]||'');
  }
  const textFor = r => drafts[r.key]?.text ?? r.text;
  function sourceTitle(r) {
    const w=SYLLABI[r.course]?.weeks[r.index];
    return `${r.course==='y1-cs50t'?'CS50T':'CS50P'} · ${w?.t||'课程讲义'}`;
  }
  function sources(refs) {
    const unique=new Map(refs.filter(watched).map(r=>[r.url,r]));
    return [...unique.values()].map(r=>`<a class="nb-source" href="${html(r.url)}" target="_blank" rel="noopener">↗ ${html(sourceTitle(r))}</a>`).join('');
  }
  function tabs() {
    return `<div class="nb-tabs" aria-label="学习空间">${[['notes','笔记'],['map','知识网'],['courses','课程与进度']].map(([id,name])=>`<button type="button" data-nb-mode="${id}" class="${state.mode===id?'on':''}" aria-pressed="${state.mode===id}">${name}</button>`).join('')}</div>`;
  }
  function header() {
    const all=records(), lessons=all.filter(r=>r.seen).length, written=all.filter(r=>textFor(r).trim()).length;
    return `<div class="nb-top"><div><div class="nb-kicker">STUDY NOTEBOOK / COMPUTER SCIENCE</div><h2>学习笔记</h2><p>写下你的理解，再看知识之间的联系。</p></div><div class="nb-stats"><b>${lessons}</b> 讲已看　·　<b>${written}</b> 篇笔记</div></div>${tabs()}`;
  }
  function renderText(text) {
    let code=false, buffer=[], out=[];
    const flush=()=>{if(buffer.length){out.push(`<pre><code>${html(buffer.join('\n'))}</code></pre>`);buffer=[];}};
    for(const line of text.split('\n')) {
      if(/^\s*```/.test(line)){ if(code)flush(); code=!code; continue; }
      if(code){buffer.push(line);continue;}
      if(/^#{1,3}\s/.test(line))out.push(`<h4>${html(line.replace(/^#{1,3}\s+/,''))}</h4>`);
      else if(/<\/?[a-z!][^>]*>?/i.test(line)||/^\s*(curl\b|import\s|from\s|def\s|pip\s|print\(|\s{4}\S)/.test(line))out.push(`<p class="nb-code-line">${html(line)||' '}</p>`);
      else out.push(`<p>${html(line)||'<br>'}</p>`);
    }
    flush(); return out.join('');
  }
  function saveLabel(key) {
    const status=statuses[key];
    if(status==='conflict')return '发现另一处更新 · 草稿已保留';
    if(status==='failed')return '云端未保存 · 可重试';
    if(status==='saving')return '正在保存…';
    if(status==='local')return '已存本机草稿 · 等待云端连接';
    if(status==='quota')return '本机存储已满 · 请立即复制备份';
    if(drafts[key])return '草稿已存本机 · 等待同步';
    if(status==='saved')return '已同步到云端';
    return '原有笔记';
  }
  function listHTML() {
    const all=records(), q=normalize(state.query);
    const found=all.filter(r=>(state.course==='all'||r.course===state.course)&&(!q||normalize(r.title+' '+r.courseName+' '+textFor(r)).includes(q)));
    const groups=[...new Set(found.map(r=>r.course))];
    return `<aside class="nb-list" aria-label="笔记目录"><label class="nb-list-heading" for="nb-search">找一篇笔记</label><input id="nb-search" type="search" placeholder="搜索笔记和课程…" value="${html(state.query)}"><select id="nb-course" class="nb-filter" aria-label="筛选笔记课程"><option value="all">全部课程</option>${[...new Set(all.map(r=>r.course))].map(id=>`<option value="${html(id)}" ${id===state.course?'selected':''}>${html(id==='loose'?'独立笔记':SYLLABI[id]?.name||id)}</option>`).join('')}</select>${groups.map(group=>`<div class="nb-list-heading">${html(group==='loose'?'独立笔记':SYLLABI[group].name.split(' · ')[0])}</div>${found.filter(r=>r.course===group).map(r=>`<button class="nb-note-link ${r.key===state.selected?'on':''}" type="button" data-nb-note="${html(r.key)}" aria-current="${r.key===state.selected?'page':'false'}"><strong>${html(r.title)}</strong><span>${textFor(r).trim()?'<i class="nb-dot"></i>有笔记':'待记笔记'}${r.index!==null?' · '+(r.seen?'讲座已看':'讲座未标记'):''}${drafts[r.key]?' · 草稿':''}</span></button>`).join('')}`).join('')}${found.length?'':'<div class="nb-no-results">没有匹配的笔记。试试另一关键词。</div>'}<button type="button" class="nb-new" data-nb-new>＋ 新建独立笔记</button></aside>`;
  }
  function conceptsFor(r) {
    return activeNodes().filter(n=>n.refs.some(f=>f.course===r.course&&f.index===r.index));
  }
  function noteHTML() {
    const r=current(); if(!r)return '<div class="nb-map-empty">还没有课程。去「课程与进度」添加一门。</div>';
    state.selected=r.key;
    const text=textFor(r), concepts=conceptsFor(r), status=statuses[r.key], isLesson=r.index!==null;
    const official=r.seen?O[r.key]:null,readOfficial=!!(official&&state.noteSource==='official');
    const sourceTabs=official?`<div class="nb-note-sources" aria-label="笔记来源"><button type="button" data-nb-source="mine" aria-pressed="${!readOfficial}">我的笔记</button><button type="button" data-nb-source="official" aria-pressed="${readOfficial}">官方笔记 <small>English</small></button></div>`:'';
    const tools=readOfficial?`<div class="nb-sheet-tools"><span class="nb-save">官方英文正文 · 只读阅读副本</span><a class="nb-plain" href="${html(official.source)}" target="_blank" rel="noopener">打开官方原文 ↗</a></div>`:`<div class="nb-sheet-tools"><div class="nb-segment"><button type="button" data-nb-edit="read" class="${!state.editing?'on':''}" aria-pressed="${!state.editing}">阅读</button><button type="button" data-nb-edit="write" class="${state.editing?'on':''}" aria-pressed="${state.editing}">编辑</button></div><div><span class="nb-save ${['failed','conflict','quota'].includes(status)?'bad':''}" role="status" id="nb-save-status">${html(saveLabel(r.key))}</span> <button type="button" class="nb-plain" data-nb-save>保存</button></div></div>`;
    const mine=state.editing?`<div class="nb-write"><textarea id="nb-editor" aria-label="笔记正文" placeholder="写下课上学到的内容。支持原样代码、Markdown 标题和代码块。" spellcheck="false">${html(text)}</textarea></div>`:`<div class="nb-reader">${text?renderText(text):'<div class="nb-empty-note"><b>留一点自己的理解。</b><span>这一讲还没有笔记。课上讲过的知识仍会出现在知识网里。</span><button class="nb-chip" type="button" data-nb-edit="write">开始写笔记</button></div>'}</div>`;
    const body=readOfficial?`<iframe id="nb-official-frame" class="nb-official-frame" data-note-key="${html(r.key)}" src="${html(official.file)}" title="官方笔记 · ${html(official.title)}" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe><footer class="nb-sheet-foot"><span>来源：CS50 · Harvard University · <a href="${html(official.license)}" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a></span><span>阅读副本 ${html(official.retrieved)}${official.images?' · 插图需联网载入':''}</span></footer>`:`${mine}<footer class="nb-sheet-foot"><span id="nb-word-count">${text.length.toLocaleString()} 字符</span><span>${state.editing?'编辑时自动保存草稿 · Ctrl / ⌘ + S 保存':'代码与 HTML 均按原文显示'}</span></footer>`;
    return `<div class="nb-layout">${listHTML()}<article class="nb-sheet" aria-label="当前笔记"><header class="nb-sheet-head"><div class="nb-breadcrumb">${html(r.courseName)}</div><h3>${html(r.title)}</h3>${sourceTabs}${tools}${isLesson?`<div class="nb-progress"><label><input type="checkbox" data-wkwatch="${html(r.key)}" ${r.seen?'checked':''}>讲座已看</label><label><input type="checkbox" data-wkdone="${html(r.key)}" ${sylDone(r.course)[r.index]?'checked':''}>作业已完成</label></div>`:''}</header>${status==='conflict'&&!readOfficial?'<div class="nb-warning">这篇笔记在另一处更新过。这里保留了你的草稿，没有覆盖另一份内容。<br><button class="nb-plain" data-nb-copy>复制我的草稿</button><button class="nb-plain" data-nb-duplicate>将草稿另存为独立笔记</button></div>':''}${body}${isLesson?`<div class="nb-context"><details><summary>本讲提纲 · ${html(r.week.en||'')}</summary>${r.week.goal?`<p>${html(r.week.goal)}</p>`:''}<ul>${(r.week.learn||[]).map(t=>`<li>${html(t)}</li>`).join('')}</ul></details>${concepts.length?`<div class="nb-chips">${concepts.map(n=>`<button class="nb-chip" type="button" data-nb-concept="${n.id}">${html(n.title)} ↗</button>`).join('')}</div><span class="nb-save">课上讲过不等于已经掌握。点击知识点，在网里查看关系。</span>`:'<p class="nb-save">本讲的知识关系尚未核对，不自动猜测连线。</p>'}</div>`:''}</article></div>`;
  }
  function relatedTo(id, edges) {return new Set([id,...edges.filter(e=>e.from===id||e.to===id).map(e=>e.from===id?e.to:e.from)]);}
  const taxonomyMatches=n=>(state.system==='all'||n.taxonomy.system===state.system)&&(state.branch==='all'||n.taxonomy.branch===state.branch);
  const searchText=n=>normalize([n.title,n.description,...n.aliases,K.systems[n.taxonomy.system].label,K.systems[n.taxonomy.system].branches[n.taxonomy.branch],n.taxonomy.kind,n.taxonomy.scope].join(' '));
  function graphData() {
    const all=activeNodes(), edges=activeEdges(all), q=normalize(state.graphQuery);
    let ids=new Set(all.map(n=>n.id));
    if(state.group!=='all') {
      ids=new Set(all.filter(n=>n.group===state.group).map(n=>n.id));
      for(const edge of edges)if(all.some(n=>n.id===edge.from&&n.group===state.group)||all.some(n=>n.id===edge.to&&n.group===state.group)){ids.add(edge.from);ids.add(edge.to);}
    }
    if(state.system!=='all'){
      const focused=all.filter(taxonomyMatches),family=new Set(focused.map(n=>n.id));
      for(const n of focused)for(const id of relatedTo(n.id,edges))family.add(id);
      ids=new Set([...ids].filter(id=>family.has(id)));
    }
    if(q){const matches=all.filter(n=>searchText(n).includes(q));const searchIds=new Set();for(const n of matches)for(const id of relatedTo(n.id,edges))searchIds.add(id); ids=new Set([...ids].filter(id=>searchIds.has(id)));}
    const nodes=all.filter(n=>ids.has(n.id));
    return {nodes,edges:edges.filter(e=>ids.has(e.from)&&ids.has(e.to))};
  }
  function positions(nodes,edges) {
    const key=nodes.map(n=>n.id).join('|'); if(positionsCache.has(key))return positionsCache.get(key);
    const groups=Object.keys(K.systems), centers=[[370,220],[650,290],[900,230],[220,540],[600,560],[960,540],[600,100]];
    const points=new Map(nodes.map((n,i)=>{const [x,y]=centers[groups.indexOf(n.taxonomy.system)];const a=i*2.399963;return[n.id,{x:x+Math.cos(a)*90,y:y+Math.sin(a)*90}];}));
    for(let iter=0;iter<170;iter++) {
      const forces=new Map(nodes.map(n=>[n.id,{x:0,y:0}]));
      for(let a=0;a<nodes.length;a++)for(let b=a+1;b<nodes.length;b++){
        const p=points.get(nodes[a].id),q=points.get(nodes[b].id);let dx=p.x-q.x,dy=p.y-q.y,d2=dx*dx+dy*dy;if(d2<1){dx=1;dy=1;d2=2;}
        const force=Math.min(12,7500/d2),d=Math.sqrt(d2);const f=forces.get(nodes[a].id),g=forces.get(nodes[b].id);f.x+=dx/d*force;f.y+=dy/d*force;g.x-=dx/d*force;g.y-=dy/d*force;
      }
      for(const e of edges){const p=points.get(e.from),q=points.get(e.to),dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1;const f=(d-135)*.012;forces.get(e.from).x+=dx/d*f;forces.get(e.from).y+=dy/d*f;forces.get(e.to).x-=dx/d*f;forces.get(e.to).y-=dy/d*f;}
      for(const n of nodes){const p=points.get(n.id),f=forces.get(n.id),[cx,cy]=centers[groups.indexOf(n.taxonomy.system)];p.x=Math.max(90,Math.min(1110,p.x+f.x+(cx-p.x)*.008));p.y=Math.max(55,Math.min(685,p.y+f.y+(cy-p.y)*.008));}
    }
    positionsCache.set(key,points);return points;
  }
  function graphSVG(nodes,edges) {
    if(!nodes.length)return '<div class="nb-map-empty">没有匹配的已学知识点。可以清空搜索，或到课程页核对讲座进度。</div>';
    const points=positions(nodes,edges), nearby=state.node?relatedTo(state.node,edges):null;
    const edgeHTML=edges.map(e=>{const a=points.get(e.from),b=points.get(e.to),near=e.from===state.node||e.to===state.node,showLabel=state.edge===e.id||(near&&Math.hypot(a.x-b.x,a.y-b.y)>210);return `<path class="nb-edge ${near?'near':''} ${state.edge===e.id?'chosen':''}" data-nb-edge="${e.id}" role="button" tabindex="0" aria-label="${html(K.nodes.find(n=>n.id===e.from).title+' '+e.label+' '+K.nodes.find(n=>n.id===e.to).title)}" d="M${a.x},${a.y} L${b.x},${b.y}" marker-end="url(#nb-arrow)"><title>${html(e.label)}</title></path>${showLabel?`<text class="nb-edge-label" x="${(a.x+b.x)/2}" y="${(a.y+b.y)/2-7}" text-anchor="middle">${html(e.label)}</text>`:''}`;}).join('');
    const nodeHTML=nodes.map(n=>{const p=points.get(n.id),chosen=state.node===n.id,color=K.systems[n.taxonomy.system].color;return `<g class="nb-node ${chosen?'chosen':''} ${nearby&&!nearby.has(n.id)?'dim':''}" data-nb-node="${n.id}" tabindex="0" role="button" aria-label="知识点：${html(n.title)}" transform="translate(${p.x},${p.y})"><rect x="-72" y="-18" width="144" height="58" fill="transparent"/><circle r="${chosen?12:7}" fill="${color}" fill-opacity="${chosen?1:.8}" stroke="${chosen?'#e9fff9':color}" stroke-width="${chosen?3:1}"/><text text-anchor="middle" y="${chosen?32:27}">${html(n.title)}</text></g>`;}).join('');
    return `<svg id="nb-network" viewBox="0 0 1200 740" aria-label="已学知识关系网"><defs><marker id="nb-arrow" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10" fill="#83b9c2"/></marker></defs><g id="nb-viewport" transform="translate(${state.panX} ${state.panY}) translate(600 370) scale(${state.zoom}) translate(-600 -370)">${edgeHTML}${nodeHTML}</g></svg>`;
  }
  function graphDetail(nodes,edges) {
    const edge=edges.find(e=>e.id===state.edge), node=nodes.find(n=>n.id===state.node);
    if(edge){const a=nodes.find(n=>n.id===edge.from),b=nodes.find(n=>n.id===edge.to);return `<div class="nb-detail-label">关系 · 已核对</div><h3>${html(a.title)}<br><span style="font-size:13px;color:var(--nb-green)">↓ ${html(edge.label)}</span><br>${html(b.title)}</h3><p>${html(edge.explanation)}</p><h4>核对依据</h4>${sources(edge.refs)}<button class="nb-relation" type="button" data-nb-node="${a.id}">查看 ${html(a.title)}</button><button class="nb-relation" type="button" data-nb-node="${b.id}">查看 ${html(b.title)}</button>`;}
    if(!node)return '<div class="nb-detail-label">从一个点开始</div><h3>它和什么有关？</h3><p>点击知识点查看解释。点连线查看关系及来源，也可以使用下方的关系列表。</p>';
    const connected=edges.filter(e=>e.from===node.id||e.to===node.id);
    const lessons=[...new Map(node.refs.filter(watched).map(r=>[`${r.course}:${r.index}`,r])).values()];
    const t=node.taxonomy,system=K.systems[t.system];
    return `<div class="nb-detail-label">课上讲过 · ${html(system.label)}</div><nav class="nb-tax-path" aria-label="知识点所属体系"><button type="button" data-nb-system="all">计算机科学</button><span>›</span><button type="button" data-nb-system="${t.system}">${html(system.label)}</button><span>›</span><button type="button" data-nb-system="${t.system}" data-nb-branch="${t.branch}">${html(system.branches[t.branch])}</button></nav><h3>${html(node.title)}</h3><dl class="nb-concept-type"><dt>它是什么</dt><dd>${html(t.kind)}</dd></dl><div class="nb-detail-label nb-purpose-label">用途 / 作用</div><p>${html(node.description)}</p>${t.scope?`<p class="nb-scope-note">${html(t.scope)}</p>`:''}<h4>在哪里学到 · 连接原笔记</h4>${lessons.map(r=>`<button type="button" class="nb-note-link" data-nb-note="${r.course}:${r.index}"><strong>${html(sourceTitle(r))} ↗</strong><span>${sylNotes(r.course)[r.index]?'打开原有笔记':'这讲尚未记笔记'}</span></button>`).join('')}<h4>直接关系 · ${connected.length}</h4>${connected.map(e=>{const other=nodes.find(n=>n.id===(e.from===node.id?e.to:e.from));return `<button type="button" class="nb-relation" data-nb-edge="${e.id}"><small>${e.from===node.id?'→':'←'} ${html(e.label)}</small>${html(other.title)}</button>`;}).join('')||'<p>这里暂时没有核对过的连线。</p>'}<h4>课程依据</h4>${sources(node.refs)}`;
  }
  function taxonomyHTML(){
    const all=activeNodes(),system=K.systems[state.system],family=all.filter(taxonomyMatches);
    const selected=all.find(n=>n.id===state.node);
    return `<section class="nb-taxonomy" aria-label="知识体系目录"><div class="nb-tax-heading"><span class="nb-detail-label">知识体系</span><span>按课程语境组织 · 分类归属与知识关系分开呈现</span></div><div class="nb-system-tabs"><button type="button" data-nb-system="all" aria-pressed="${state.system==='all'}">全部体系 <small>${all.length}</small></button>${Object.entries(K.systems).map(([id,s])=>{const count=all.filter(n=>n.taxonomy.system===id).length;return count?`<button type="button" data-nb-system="${id}" style="--system-color:${s.color}" aria-pressed="${state.system===id}">${html(s.label)} <small>${count}</small></button>`:'';}).join('')}</div>${system?`<div class="nb-branch-tabs"><button type="button" data-nb-system="${state.system}" data-nb-branch="all" aria-pressed="${state.branch==='all'}">全部分类</button>${Object.entries(system.branches).map(([id,label])=>{const count=all.filter(n=>n.taxonomy.system===state.system&&n.taxonomy.branch===id).length;return count?`<button type="button" data-nb-system="${state.system}" data-nb-branch="${id}" aria-pressed="${state.branch===id}">${html(label)} <small>${count}</small></button>`:'';}).join('')}</div><div class="nb-tax-members" aria-label="当前分类的已学知识点">${family.map(n=>`<button type="button" data-nb-tax-node="${n.id}" aria-pressed="${state.node===n.id}"><span>${html(n.title)}</span><small>${html(n.taxonomy.kind)}</small></button>`).join('')}</div><p class="nb-tax-help">目录只列当前分类；星图同时保留直接相连的跨分类知识点，连线仍表示具体关系。</p>`:`<p class="nb-tax-help">点一个体系，再逐层查看分类和具体知识点。${selected?`当前：${html(K.systems[selected.taxonomy.system].label)} › ${html(K.systems[selected.taxonomy.system].branches[selected.taxonomy.branch])} › ${html(selected.title)}`:''}</p>`}</section>`;
  }
  function graphScene(nodes,edges) {
    if(!nodes.length||typeof NotebookGraph3D==='undefined'){pendingGraph=null;return graphSVG(nodes,edges);}
    pendingGraph={nodes:nodes.map(n=>({...n,group:n.taxonomy.system})),edges,groups:K.systems,selectedNode:state.node,selectedEdge:state.edge,
      onNode(id){state.node=id;state.edge=null;render();},onEdge(id){state.edge=id;render();}};
    return '<div class="nb-three" id="nb-three"><canvas tabindex="0" aria-label="三维知识网；可拖动旋转、缩放，也可用方向键旋转。"></canvas><div class="nb-3d-labels"></div><span class="nb-3d-orientation" aria-hidden="true">3D</span></div>';
  }
  function afterRender() {
    const reader=document.getElementById('nb-official-frame');
    if(reader){const restore=()=>{const point=officialScroll.get(reader.dataset.noteKey);if(point)try{reader.contentWindow.scrollTo(point.x,point.y);}catch(_){} };reader.addEventListener('load',restore,{once:true});}
    if(typeof NotebookGraph3D==='undefined')return;
    const container=document.getElementById('nb-three');
    if(!container||!pendingGraph){NotebookGraph3D.dispose();return;}
    if(!NotebookGraph3D.mount(container,pendingGraph))container.innerHTML=graphSVG(pendingGraph.nodes,pendingGraph.edges);
  }
  function mapHTML() {
    const {nodes,edges}=graphData(); if(state.node&&!nodes.some(n=>n.id===state.node)){state.node=null;state.edge=null;}
    const notReviewed=records().filter(r=>r.seen&&!K.nodes.some(n=>n.refs.some(f=>f.course===r.course&&f.index===r.index)));
    return `<div class="nb-map-intro"><p>${nodes.length} 个已学知识点 · ${edges.length} 条有解释的关系。课上讲过 ≠ 已经掌握。</p><div class="nb-map-controls"><input type="search" id="nb-graph-search" placeholder="搜索名称、分类、用途…" value="${html(state.graphQuery)}" aria-label="搜索知识点"></div></div>
      ${taxonomyHTML()}<div class="nb-map-layout"><section class="nb-map-canvas" aria-label="可旋转的三维知识网">${graphScene(nodes,edges)}
      <div class="nb-map-buttons"><button type="button" data-nb-zoom="in" aria-label="放大知识网">＋</button><button type="button" data-nb-zoom="out" aria-label="缩小知识网">−</button><button type="button" data-nb-zoom="reset">复位</button><button type="button" data-nb-zoom="auto" aria-pressed="false">自动旋转</button></div>
      <div class="nb-legend">${Object.entries(K.systems).filter(([id])=>activeNodes().some(n=>n.taxonomy.system===id)).map(([id,g])=>`<button type="button" data-nb-system="${id}"><i style="background:${g.color}"></i>${html(g.label)}</button>`).join('')}<span>颜色 = 所属体系 · 拖动旋转 · 双指缩放 · 点连线查看关系</span></div></section><aside class="nb-map-detail" aria-label="知识关系详情">${graphDetail(nodes,edges)}</aside></div>${notReviewed.length?`<p class="nb-save">另有 ${notReviewed.length} 讲已标记看完，知识关系待核对，暂不生成猜测连线。</p>`:''}`;
  }
  function renderWorkspace() {
    loadDrafts();
    return `<div class="nb">${header()}${state.mode==='map'?mapHTML():noteHTML()}</div>`;
  }
  function updateStatus() {
    const el=document.getElementById('nb-save-status');if(!el)return;
    el.textContent=saveLabel(state.selected);el.classList.toggle('bad',['failed','conflict','quota'].includes(statuses[state.selected]));
  }
  function input(text) {
    loadDrafts();const key=state.selected;
    const existing=drafts[key];drafts[key]={text,base:existing?.base??serverText(key),updatedAt:Date.now()};
    statuses[key]=persistDrafts()?'pending':'quota';updateStatus();
    const count=document.getElementById('nb-word-count');if(count)count.textContent=text.length.toLocaleString()+' 字符';
    clearTimeout(timer);timer=setTimeout(()=>save(key),850);
  }
  function save(key=state.selected) {
    clearTimeout(timer);
    const owner=accountKey;
    const write=async()=>{
      if(owner!==accountKey||owner!=='study-notebook-drafts-v2:'+(sess?.email||'local'))return;
      const entry=drafts[key];if(!entry)return;
      const snapshot={...entry},remote=serverText(key);
      if(remote!==snapshot.base&&remote!==snapshot.text){statuses[key]='conflict';if(state.selected===key)render();return;}
      if(!db&&sess){statuses[key]='local';updateStatus();return;}
      statuses[key]='saving';updateStatus();
      const isLoose=key.startsWith('note:'),[course,index]=key.split(':'),col=isLoose?'notes':'syllabus',id=isLoose?key.slice(5):course;
      const previous=mem[col][id];
      const payload=isLoose?{...(previous||{subject:'computer',createdAt:now()}),text:snapshot.text,updatedAt:now()}:{...(previous||{}),notes:{...(previous?.notes||{}),[index]:snapshot.text}};
      try {
        if(db)await db.doc(`${col}/${id}`).set(payload);
        mem[col][id]=payload;lsSave();
        if(drafts[key]?.text===snapshot.text){delete drafts[key];statuses[key]=db?'saved':'local';}
        else if(drafts[key]){drafts[key].base=snapshot.text;statuses[key]='pending';}
        persistDrafts();updateStatus();
      } catch(_) {statuses[key]='failed';updateStatus();}
    };
    queue=queue.then(write,write);return queue;
  }
  function select(key) {save();state.selected=key;state.mode='notes';state.noteSource='mine';state.editing=false;persistView();render();}
  function setMode(mode){if(state.mode==='courses'&&openWk)wknCommit(openWk);save();state.mode=mode;persistView();render();}
  function focusEditor(){const el=document.getElementById('nb-editor');if(el)el.focus({preventScroll:true});}
  function updateTransform(){const g=document.getElementById('nb-viewport');if(g)g.setAttribute('transform',`translate(${state.panX} ${state.panY}) translate(600 370) scale(${state.zoom}) translate(-600 -370)`);}
  function handleClick(e) {
    const target=e.target.closest('[data-nb-mode],[data-nb-note],[data-nb-edit],[data-nb-save],[data-nb-new],[data-nb-node],[data-nb-edge],[data-nb-concept],[data-nb-zoom],[data-nb-copy],[data-nb-duplicate],[data-nb-system],[data-nb-tax-node],[data-nb-source]');
    if(!target)return false;
    const d=target.dataset;
    if(d.nbSource){save();beforeRender();state.noteSource=d.nbSource==='official'?'official':'mine';state.editing=false;render();return true;}
    if(d.nbSystem){state.system=d.nbSystem;state.branch=d.nbBranch||'all';state.group='all';state.graphQuery='';state.edge=null;const family=activeNodes().filter(taxonomyMatches);if(!family.some(n=>n.id===state.node))state.node=family[0]?.id||null;render();return true;}
    if(d.nbTaxNode){state.node=d.nbTaxNode;state.edge=null;state.graphQuery='';render();return true;}
    if(d.nbMode){setMode(d.nbMode);return true;}
    if(d.nbNote){select(d.nbNote);return true;}
    if(d.nbEdit){if(d.nbEdit==='read')save();state.noteSource='mine';state.editing=d.nbEdit==='write';render();if(state.editing)focusEditor();return true;}
    if('nbSave'in d){save();return true;}
    if('nbNew'in d){save();const id=uid(),key=`note:${id}`;mem.notes[id]={subject:'computer',text:'',createdAt:now()};lsSave();state.selected=key;state.editing=true;state.mode='notes';render();focusEditor();return true;}
    if(d.nbNode||d.nbConcept){state.node=d.nbNode||d.nbConcept;state.edge=null;if(d.nbConcept){save();state.mode='map';state.group='all';state.system='all';state.branch='all';state.graphQuery='';persistView();}render();return true;}
    if(d.nbEdge){state.edge=d.nbEdge;render();return true;}
    if(d.nbZoom){if(typeof NotebookGraph3D!=='undefined'&&NotebookGraph3D.action(d.nbZoom))return true;if(d.nbZoom==='auto')return true;if(d.nbZoom==='reset'){state.zoom=1;state.panX=0;state.panY=0;}else state.zoom=Math.max(.5,Math.min(2.8,state.zoom*(d.nbZoom==='in'?1.2:1/1.2)));updateTransform();return true;}
    if('nbCopy'in d){copyText(textFor(current()),'草稿已复制');return true;}
    if('nbDuplicate'in d){const text=textFor(current()),id=uid();store.set('notes',id,{subject:'computer',text,createdAt:now()});state.selected=`note:${id}`;state.mode='notes';state.editing=false;render();return true;}
    return false;
  }
  document.addEventListener('input',e=>{
    if(e.target.id==='nb-editor'){if(!e.isComposing)input(e.target.value);else{loadDrafts();const key=state.selected;drafts[key]={text:e.target.value,base:drafts[key]?.base??serverText(key),updatedAt:Date.now()};persistDrafts();}return;}
    if(e.target.id==='nb-search'){state.query=e.target.value;render();}
    if(e.target.id==='nb-graph-search'){state.graphQuery=e.target.value;const q=normalize(state.graphQuery.trim());if(q){const match=activeNodes().find(n=>normalize(n.title)===q||n.aliases.some(a=>normalize(a)===q))||activeNodes().find(n=>normalize(n.title).includes(q));if(match){state.node=match.id;state.edge=null;if(!taxonomyMatches(match)){state.system='all';state.branch='all';}}}render();}
  });
  document.addEventListener('compositionend',e=>{if(e.target.id==='nb-editor')input(e.target.value);});
  document.addEventListener('change',e=>{if(e.target.id==='nb-course'){state.course=e.target.value;render();}if(e.target.id==='nb-group'){state.group=e.target.value;state.edge=null;render();}});
  document.addEventListener('keydown',e=>{
    if(cur==='computer'&&state.mode==='notes'&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();}
    if((e.key==='Enter'||e.key===' ')&&e.target.matches('.nb-node,.nb-edge')){e.preventDefault();handleClick(e);}
    if(e.target.id==='nb-editor'&&e.key==='Tab'){e.preventDefault();const el=e.target,start=el.selectionStart;el.setRangeText('    ',start,el.selectionEnd,'end');input(el.value);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
  window.addEventListener('pagehide',persistDrafts);
  document.addEventListener('pointerdown',e=>{const svg=e.target.closest('#nb-network');if(!svg||e.target.closest('.nb-node,.nb-edge'))return;const rect=svg.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:state.panX,py:state.panY,scale:Math.max(1200/rect.width,740/rect.height)};svg.setPointerCapture(e.pointerId);});
  document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;state.panX=drag.px+(e.clientX-drag.x)*drag.scale;state.panY=drag.py+(e.clientY-drag.y)*drag.scale;updateTransform();});
  document.addEventListener('pointerup',()=>{drag=null;});document.addEventListener('pointercancel',()=>{drag=null;});
  function beforeRender(){const reader=document.getElementById('nb-official-frame');if(reader)try{if(reader.contentDocument?.readyState==='complete'&&reader.contentDocument.querySelector('main'))officialScroll.set(reader.dataset.noteKey,{x:reader.contentWindow.scrollX,y:reader.contentWindow.scrollY});}catch(_){} }
  return {get mode(){loadDrafts();return state.mode;},render:renderWorkspace,tabs,handleClick,save,select,activeNodes,activeEdges,graphData,beforeRender,afterRender};
})();
