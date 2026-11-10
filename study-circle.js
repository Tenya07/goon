/* Personal interest feed. Editorial cards are not posts by real users.
   User reflections/preferences use the notebook's existing private docs store. */
const StudyCircle = (() => {
  const C=StudyCircleContent;
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const topic=id=>C.topics.find(t=>t.id===id)||C.topics[0];
  const ui={view:'for-you',topic:'all',query:'',limit:6,seed:0,thought:null,composer:false,settings:false,answers:{},drafts:{},notice:''};
  let account=null,pending={},syncing=false,retryTimer=null,nextAttempt=0;
  const accountId=()=>sess?.email||'local';
  const storageKey=()=>`study-circle-pending-v1:${account}`;
  const clone=v=>JSON.parse(JSON.stringify(v));
  function loadAccount(){
    const key=accountId(); if(account===key)return;
    account=key;pending={};nextAttempt=0;clearTimeout(retryTimer);
    Object.assign(ui,{view:'for-you',topic:'all',query:'',limit:6,seed:0,thought:null,composer:false,settings:false,answers:{},drafts:{},notice:''});
    try{const saved=JSON.parse(localStorage.getItem(storageKey())||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))pending=saved;}catch(_){}
  }
  function entries(){loadAccount();return {...(mem.circle||{}),...pending};}
  const entry=id=>entries()[id]||{};
  function preferences(){
    const selected=entry('preferences').topics;
    return Array.isArray(selected)&&selected.some(id=>C.topics.some(t=>t.id===id))?C.topics.filter(t=>selected.includes(t.id)).map(t=>t.id):C.topics.map(t=>t.id);
  }
  function persistPending(){
    try{localStorage.setItem(storageKey(),JSON.stringify(pending));return true;}
    catch(_){ui.notice='本机空间不足，请先复制保留你输入的内容。';return false;}
  }
  function queue(id,data){
    loadAccount();
    const value={...data,updatedAt:now()};
    pending[id]=value;persistPending();
    if(value.type!=='note-copy'){mem.circle=mem.circle||{};mem.circle[id]=clone(value);}lsSave();nextAttempt=0;
    flush();
  }
  async function flush(){
    loadAccount();
    if(syncing||!db||!sess||Date.now()<nextAttempt||!Object.keys(pending).length)return;
    const owner=account,writer=db;syncing=true;
    try{
      for(const id of Object.keys(pending)){
        if(owner!==accountId())break;
        const value=pending[id];if(!value)continue;
        const snapshot=JSON.stringify(value);
        const isNote=value.type==='note-copy';
        if(isNote)await writer.doc('notes/'+value.noteId).set(clone(mem.notes?.[value.noteId]||value.note));
        else await writer.doc('circle/'+id).set(clone(value));
        if(owner!==accountId())break;
        if(!isNote){mem.circle=mem.circle||{};mem.circle[id]=clone(value);}lsSave();
        if(JSON.stringify(pending[id])===snapshot){delete pending[id];persistPending();}
      }
    }catch(_){nextAttempt=Date.now()+15000;}
    finally{
      syncing=false;
      if(owner!==accountId()){loadAccount();return;}
      const status=document.getElementById('sf-sync');if(status)status.textContent=syncText();
      clearTimeout(retryTimer);
      if(Object.keys(pending).length&&db&&sess)retryTimer=setTimeout(()=>{nextAttempt=0;flush();},15000);
    }
  }
  function syncText(){
    if(Object.keys(pending).length)return db&&sess?'已存本机 · 正在等待云端同步':'已存本机 · 登录后同步';
    return sess&&db?'偏好与想法随学习本同步':'本机预览 · 不连接云端';
  }
  function allPosts(){
    const mine=Object.entries(entries()).filter(([,v])=>v?.type==='post'&&!v.deleted&&typeof v.text==='string').map(([id,v])=>({id,topic:C.topics.some(t=>t.id===v.topic)?v.topic:'python',title:'我的一条学习碎片',body:v.text.slice(0,2000),mine:true,createdAt:v.createdAt,sources:[]}));
    return [...mine.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')),...C.posts];
  }
  function hash(s){let n=0;for(const c of s)n=(Math.imul(n,31)+c.charCodeAt(0))|0;return n>>>0;}
  function filtered(){
    const prefs=preferences(),q=ui.query.trim().toLocaleLowerCase();
    let list=allPosts().filter(p=>{
      const s=entry('state-'+p.id);
      if(ui.view==='saved'&&!s.saved)return false;
      if(ui.view==='mine'&&!p.mine)return false;
      if(ui.view==='for-you'&&(s.hidden||!prefs.includes(p.topic)))return false;
      if(ui.topic!=='all'&&p.topic!==ui.topic)return false;
      return !q||[p.title,p.body,p.takeaway,p.code,topic(p.topic).name].join(' ').toLocaleLowerCase().includes(q);
    });
    if(ui.view==='for-you'){
      const buckets=C.topics.map(t=>{
        const group=list.filter(p=>p.topic===t.id).sort((a,b)=>hash(a.id)-hash(b.id));
        const shift=group.length?ui.seed%group.length:0;
        return [...group.slice(shift),...group.slice(0,shift)];
      });
      const total=list.length;
      list=[];for(let i=0;list.length<total;i++)for(let k=0;k<buckets.length;k++){
        const group=buckets[(k+ui.seed)%buckets.length];if(group[i])list.push(group[i]);
      }
    }
    return list;
  }
  const icon=name=>{
    const paths={heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',save:'M6 3h12v18l-6-4-6 4V3Z',chat:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A9.5 9.5 0 0 1 21 11.5Z',note:'M13 3H5v18h14V9M13 3v6h6M8 13h8M8 17h5',refresh:'M20 7v5h-5M4 17v-5h5M5.7 7a7 7 0 0 1 12-1L20 9M4 15l2.3 3a7 7 0 0 0 12-1',arrow:'M5 12h14M13 6l6 6-6 6',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'};
    return `<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.arrow}"/></svg>`;
  };
  function visual(p){
    const box=(type,inside)=>`<div class="sf-visual sf-v-${type}" aria-label="${h(p.title)}">${inside}</div>`;
    if(p.visual==='request')return box('request','<span>浏览器</span><i>HTTP 请求 →<br>← HTML / JSON / 图片</i><span>服务器</span>');
    if(p.visual==='triads')return box('triads','<div><b>T</b><span><em>1</em> · 3 · <em>5</em></span></div><div><b>S</b><span>4 · 6 · <em>1</em></span></div><div><b>D</b><span><em>5</em> · 7 · 2</span></div>');
    if(p.visual==='latency')return box('chain',['采集','编码','传输','解码','显示'].map((x,i)=>`<span>${x}</span>${i<4?'<i>→</i>':''}`).join(''));
    if(p.visual==='combinations')return box('combo','<span>9</span><i>×</i><span>9</span><i>×</i><span>9</span><i>×</i><span>9</span><strong>= 6561</strong>');
    if(p.visual==='rgb')return box('rgb','<i class="sf-red"></i><i class="sf-green"></i><i class="sf-blue"></i><span>RED · GREEN · BLUE</span>');
    if(p.visual==='space')return box('space','<div>慢一点，<br>看见空隙。</div><div>慢一点，<br>看见空隙。</div>');
    if(p.visual==='context')return box('context','<div>当前上下文<span>你的问题　·　相关资料　·　回答空间</span></div><small>≠ 模型训练时见过的全部资料</small>');
    if(p.visual==='api')return box('api','<span>输入</span><i>→</i><b>约定的接口</b><i>→</i><span>结果</span>');
    if(p.visual==='links')return box('links','<span>浏览器</span><i>解析 →</i><span>HTML</span>');
    if(p.visual==='wave')return box('wave','<svg viewBox="0 0 500 90" aria-hidden="true"><path d="M0 45Q31 0 62 45T124 45T186 45T248 45T310 45T372 45T434 45T496 45"/><path d="M0 45Q15 20 31 45T62 45T93 45T124 45T155 45T186 45T217 45T248 45T279 45T310 45T341 45T372 45T403 45T434 45T465 45T496 45"/></svg><span>440 Hz　→　880 Hz</span>');
    return '';
  }
  function lessonLabel(p){
    if(!p.lesson)return '兴趣拓展';
    const [id,i]=p.lesson;
    return mem.courses[id]&&(sylWatch(id)[i]||sylDone(id)[i])?'接着你学过的 · '+(id==='y1-cs50p'?'CS50P':'CS50T'):'兴趣拓展';
  }
  function card(p){
    const t=topic(p.topic),s=entry('state-'+p.id),r=entry('thought-'+p.id),thought=ui.thought===p.id;
    const text=ui.drafts[p.id]??r.text??'';
    const noteId='circle-'+p.id,noteSaved=!!mem.notes?.[noteId];
    return `<article class="sf-card" id="sf-card-${h(p.id)}" style="--sf-tone:${t.color}">
      <header class="sf-author"><div class="sf-avatar ${p.mine?'sf-self':''}" aria-hidden="true">${p.mine?'我':h(t.mark)}</div><div><strong>${p.mine?'我':h(t.author)}</strong><span>${p.mine?'自己的记录 · '+h(fmt(p.createdAt)):'兴趣栏目 · AI 整理手记'}</span></div><span class="sf-topic-name">${h(t.name)}</span></header>
      <div class="sf-post-body"><h3>${h(p.title)}</h3>${p.body.split('\n').map(line=>`<p>${h(line)}</p>`).join('')}${p.code?`<pre><code>${h(p.code)}</code></pre>`:''}${visual(p)}
      ${p.takeaway?`<div class="sf-takeaway"><span>留住这一点</span><p>${h(p.takeaway)}</p></div>`:''}
      ${p.prompt?`<details class="sf-question" data-sf-detail="${h(p.id)}" ${ui.answers[p.id]?'open':''}><summary>${h(p.prompt)}<span>想一下，再看</span></summary><p>${h(p.answer)}</p></details>`:''}
      ${p.sources.length?`<div class="sf-sources">${p.sources.map(([label,url])=>`<a href="${h(url)}" target="_blank" rel="noopener noreferrer">${h(label)} ↗</a>`).join('')}</div>`:''}
      <div class="sf-card-meta"><span>${p.mine?'只有自己可见':h(lessonLabel(p))}</span>${p.mine?'':`<button type="button" data-sf-action="hide" data-sf-id="${h(p.id)}">少看这条</button>`}</div></div>
      <footer class="sf-card-actions"><button type="button" data-sf-action="like" data-sf-id="${h(p.id)}" aria-pressed="${!!s.liked}" aria-label="${s.liked?'取消喜欢':'喜欢'}：${h(p.title)}">${icon('heart')}<span>${s.liked?'喜欢了':'喜欢'}</span></button><button type="button" data-sf-action="save" data-sf-id="${h(p.id)}" aria-pressed="${!!s.saved}" aria-label="${s.saved?'取消收藏':'收藏'}：${h(p.title)}">${icon('save')}<span>${s.saved?'已收藏':'收藏'}</span></button><button type="button" data-sf-action="thought" data-sf-id="${h(p.id)}" aria-expanded="${thought}">${icon('chat')}<span>${r.text?'我的想法':'留个想法'}</span></button><button type="button" data-sf-action="note" data-sf-id="${h(p.id)}" ${noteSaved?'disabled':''}>${icon('note')}<span>${noteSaved?'已记入笔记':'记入笔记'}</span></button></footer>
      ${thought?`<form class="sf-thought" data-sf-form="thought" data-sf-id="${h(p.id)}"><label for="sf-thought-${h(p.id)}">给自己留一句话</label><textarea id="sf-thought-${h(p.id)}" data-sf-draft="${h(p.id)}" maxlength="1000" rows="3" placeholder="我想到了什么？哪里还没懂？">${h(text)}</textarea><div><span>只有自己可见</span><button type="submit">保存想法</button></div></form>`:r.text?`<div class="sf-thought-saved"><span>我的想法</span><p>${h(r.text)}</p></div>`:''}
    </article>`;
  }
  function renderFeed(){
    loadAccount();
    const list=filtered(),all=allPosts(),prefs=preferences(),values=entries();
    const saved=all.filter(p=>entry('state-'+p.id).saved).length;
    const thoughts=Object.values(values).filter(v=>v?.type==='thought'&&v.text).length;
    const hidden=C.posts.filter(p=>entry('state-'+p.id).hidden).length;
    return `<section class="sf-page" aria-label="学习圈"><header class="sf-hero"><div class="sf-hero-stars" aria-hidden="true"></div><div class="sf-hero-copy"><div class="sf-eyebrow">A LITTLE CURIOSITY, EVERY DAY</div><h2>学习圈<span>给好奇心留个位置。</span></h2><p>编程里的一点灵光，音乐里的一次恍然。<br>不赶进度，遇到喜欢的就停一会儿。</p><div class="sf-disclosure"><i></i>按你的兴趣编写 · 栏目手记不是他人真实动态</div></div><div class="sf-orbit" aria-hidden="true"><i></i><i></i><i></i><span>✦</span><b>STAY<br>CURIOUS</b></div></header>
      <div class="sf-layout"><div class="sf-stream"><div class="sf-stream-top"><nav class="sf-views" aria-label="动态视图">${[['for-you','为你'],['saved','收藏 '+saved],['mine','我写的']].map(([id,label])=>`<button type="button" data-sf-view="${id}" aria-pressed="${ui.view===id}">${label}</button>`).join('')}</nav><button class="sf-shuffle" type="button" data-sf-action="shuffle">${icon('refresh')}换个顺序</button></div>
      <div class="sf-search">${icon('search')}<input id="sf-search" type="search" value="${h(ui.query)}" placeholder="找一个感兴趣的话题…" aria-label="搜索学习动态"></div>
      <nav class="sf-topic-filters" aria-label="筛选兴趣主题">${[{id:'all',name:'全部'},...C.topics].map(t=>`<button type="button" data-sf-topic="${t.id}" aria-pressed="${ui.topic===t.id}">${h(t.name)}</button>`).join('')}</nav>
      <div class="sf-compose"><button class="sf-compose-open" type="button" data-sf-action="compose" aria-expanded="${ui.composer}"><span class="sf-avatar sf-self">我</span><span>今天有什么小发现？</span><b>＋ 写一条</b></button>${ui.composer?`<form data-sf-form="post"><label class="sf-sr" for="sf-compose-text">我的学习动态</label><textarea id="sf-compose-text" data-sf-draft="compose" maxlength="2000" rows="4" placeholder="只写一两句也可以。它会留在自己的学习圈里。">${h(ui.drafts.compose||'')}</textarea><div><label for="sf-compose-topic">放在 <select id="sf-compose-topic">${C.topics.map(t=>`<option value="${t.id}" ${t.id===(ui.drafts.composeTopic||'python')?'selected':''}>${h(t.name)}</option>`).join('')}</select></label><button type="submit">留在学习圈</button></div></form>`:''}</div>
      <p id="sf-notice" class="sf-notice" role="status">${h(ui.notice)}</p>
      <div class="sf-results-label">${ui.view==='for-you'?'你的兴趣书签，慢慢往下翻。':ui.view==='saved'?'喜欢的东西，留在这里。':'自己的发现，不用写得很完整。'}<span>${list.length} 条</span></div>
      <div class="sf-posts">${list.slice(0,ui.limit).map(card).join('')||`<div class="sf-empty"><b>${ui.query?'还没有找到这个话题':ui.view==='saved'?'遇到喜欢的，点一下收藏':ui.view==='mine'?'给今天留一个小发现':'这一组暂时没有动态'}</b><p>${ui.query?'试试 Python、和弦、API，或者清空搜索。':'可以调整上面的主题，或写下自己的第一条。'}</p>${ui.query?'<button type="button" data-sf-action="clear">清空搜索</button>':''}</div>`}</div>
      ${list.length>ui.limit?`<button type="button" class="sf-load-more" data-sf-action="more">再看几条 ${icon('arrow')}</button>`:list.length?'<div class="sf-end">✦　先看到这里。喜欢的东西，慢慢来。</div>':''}</div>
      <aside class="sf-aside"><section class="sf-interest-panel"><div class="sf-aside-kicker">YOUR LITTLE UNIVERSE</div><h3>你感兴趣的世界</h3><p>先从我们聊过的兴趣出发。<br>以后也可以随时改。</p><div class="sf-interest-chips">${C.topics.filter(t=>prefs.includes(t.id)).map(t=>`<span style="--sf-tone:${t.color}"><i></i>${h(t.name)}</span>`).join('')}</div><button class="sf-edit-interests" type="button" data-sf-action="settings" aria-expanded="${ui.settings}">${ui.settings?'收起兴趣设置':'调整我的兴趣'} ↗</button>
      ${ui.settings?`<div class="sf-settings"><p>至少选一个；收藏不会因取消兴趣而消失。</p>${C.topics.map(t=>`<label><input type="checkbox" data-sf-interest="${t.id}" ${prefs.includes(t.id)?'checked':''}><span>${h(t.name)}<small>${h(t.why)}</small></span></label>`).join('')}${hidden?`<button type="button" data-sf-action="restore">恢复少看的 ${hidden} 条内容</button>`:''}</div>`:''}</section>
      <section class="sf-shelf"><div class="sf-aside-kicker">A FEW THINGS TO KEEP</div><div><b>${saved}</b><span>收藏的小发现</span></div><div><b>${thoughts}</b><span>自己留下的想法</span></div><button type="button" data-sf-view="saved">打开我的收藏 ${icon('arrow')}</button></section><section class="sf-aside-note"><span>关于这里</span><p>这是为你整理的兴趣阅读，不是实时社交平台。事实内容附参考资料，练习与设计建议会说明语境。</p><p>收藏和想法只有自己可见；记入笔记不会自动标记课程学完。</p><span id="sf-sync">${h(syncText())}</span><small>首批 ${C.posts.length} 条 · 整理于 ${C.edition}<br>“换个顺序”重排已有内容，不会生成新文章。</small></section></aside></div></section>`;
  }
  function repaint(selector){render();if(selector)document.querySelector(selector)?.focus({preventScroll:true});}
  function changeState(id,field){const state=entry('state-'+id);queue('state-'+id,{...state,type:'state',[field]:!state[field]});repaint(`[data-sf-action="${field==='liked'?'like':'save'}"][data-sf-id="${id}"]`);}
  function handleClick(e){
    const target=e.target.closest('[data-sf-action],[data-sf-topic],[data-sf-view]');if(!target)return false;
    loadAccount();const d=target.dataset;
    if(d.sfTopic){ui.topic=d.sfTopic;ui.limit=6;ui.notice='';repaint(`[data-sf-topic="${d.sfTopic}"]`);return true;}
    if(d.sfView){ui.view=d.sfView;ui.topic='all';ui.query='';ui.limit=6;ui.notice='';repaint(`[data-sf-view="${d.sfView}"]`);return true;}
    const p=allPosts().find(p=>p.id===d.sfId),action=d.sfAction;
    if(action==='like'&&p)changeState(p.id,'liked');
    else if(action==='save'&&p)changeState(p.id,'saved');
    else if(action==='hide'&&p){queue('state-'+p.id,{...entry('state-'+p.id),type:'state',hidden:true});ui.notice='这条已从「为你」收起，可在兴趣设置里恢复。';repaint();}
    else if(action==='thought'&&p){ui.thought=ui.thought===p.id?null:p.id;repaint();if(ui.thought)document.getElementById('sf-thought-'+p.id)?.focus();}
    else if(action==='note'&&p){
      const id='circle-'+p.id;if(mem.notes?.[id])return true;
      const note=[p.title,p.body,p.code,p.takeaway?'要点：'+p.takeaway:'',entry('thought-'+p.id).text?'我的想法：'+entry('thought-'+p.id).text:'',...p.sources.map(([label,url])=>label+'：'+url)].filter(Boolean).join('\n\n');
      // Save through a private circle queue first, then the existing note store.
      queue('note-'+p.id,{type:'note-copy',noteId:id,note:{subject:topic(p.topic).subject,text:note,createdAt:now(),source:'学习圈',circlePost:p.id}});
      mem.notes=mem.notes||{};mem.notes[id]=clone(entry('note-'+p.id).note);lsSave();ui.notice='已收进「'+(topic(p.topic).subject==='computer'?'电脑':topic(p.topic).subject==='school'?'学校':topic(p.topic).subject==='ielts'?'英语':'AI')+'」笔记；课程进度不变。';repaint();
    }
    else if(action==='shuffle'){ui.seed++;ui.limit=6;ui.notice='换了一个顺序，仍是已经整理好的内容。';repaint('[data-sf-action="shuffle"]');}
    else if(action==='more'){ui.limit+=6;ui.notice='';repaint();}
    else if(action==='clear'){ui.query='';ui.limit=6;repaint('#sf-search');}
    else if(action==='compose'){ui.composer=!ui.composer;repaint();if(ui.composer)document.getElementById('sf-compose-text')?.focus();}
    else if(action==='settings'){ui.settings=!ui.settings;repaint('[data-sf-action="settings"]');}
    else if(action==='restore'){for(const p of C.posts)if(entry('state-'+p.id).hidden)queue('state-'+p.id,{...entry('state-'+p.id),hidden:false});ui.notice='已恢复收起的内容。';repaint();}
    return true;
  }
  function afterRender(){
    loadAccount();
    for(const [id,v] of Object.entries(pending))if(v?.type==='note-copy'&&v.note&&typeof v.note.text==='string'){
      mem.notes=mem.notes||{};
      if(!mem.notes[v.noteId])mem.notes[v.noteId]=clone(v.note);
    }
    flush();
  }
  document.addEventListener('input',e=>{
    if(e.target.dataset?.sfDraft)ui.drafts[e.target.dataset.sfDraft]=e.target.value;
    if(e.target.id==='sf-search'&&!e.isComposing){ui.query=e.target.value;ui.limit=6;repaint();}
  });
  document.addEventListener('compositionend',e=>{if(e.target.id==='sf-search'){ui.query=e.target.value;ui.limit=6;repaint();}});
  document.addEventListener('change',e=>{
    if(e.target.id==='sf-compose-topic'){ui.drafts.composeTopic=e.target.value;return;}
    const id=e.target.dataset?.sfInterest;if(!id)return;
    let selected=preferences();selected=e.target.checked?[...new Set([...selected,id])]:selected.filter(t=>t!==id);
    if(!selected.length){e.target.checked=true;ui.notice='至少留一个喜欢的主题。';repaint();return;}
    queue('preferences',{type:'preferences',topics:selected});ui.limit=6;ui.notice='兴趣已更新。';repaint(`[data-sf-interest="${id}"]`);
  });
  document.addEventListener('submit',e=>{
    const form=e.target.closest('[data-sf-form]');if(!form)return;e.preventDefault();
    if(form.dataset.sfForm==='thought'){
      const id=form.dataset.sfId,text=(ui.drafts[id]??document.getElementById('sf-thought-'+id)?.value??'').trim().slice(0,1000);
      queue('thought-'+id,{type:'thought',text});delete ui.drafts[id];ui.thought=null;ui.notice=text?'自己的想法已保存。':'已清空这条想法。';repaint();
    }else{
      const text=(ui.drafts.compose||'').trim().slice(0,2000);if(!text){ui.notice='先写一句自己的发现。';repaint('#sf-compose-text');return;}
      const chosen=document.getElementById('sf-compose-topic')?.value||'python';queue('post-'+uid(),{type:'post',text,topic:chosen,createdAt:now()});
      delete ui.drafts.compose;ui.composer=false;ui.view='mine';ui.topic='all';ui.query='';ui.notice='留下来了。只有你自己能看到。';repaint();
    }
  });
  document.addEventListener('toggle',e=>{const id=e.target.dataset?.sfDetail;if(id)ui.answers[id]=e.target.open;},true);
  return {render:renderFeed,handleClick,afterRender};
})();
