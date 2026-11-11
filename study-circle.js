/* Personal interest feed. Editorial cards are not posts by real users.
   User reflections/preferences use the notebook's existing private docs store. */
const StudyCircle = (() => {
  const C=StudyCircleContent;
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const topic=id=>C.topics.find(t=>t.id===id)||C.topics[0];
  const initialUI=()=>({view:'for-you',topic:'all',query:'',limit:6,seed:0,thought:null,menu:null,unread:false,composer:false,settings:false,answers:{},expanded:{},drafts:{},notice:''});
  const ui=initialUI();
  let account=null,pending={},syncing=false,retryTimer=null,nextAttempt=0;
  const accountId=()=>sess?.email||'local';
  const storageKey=()=>`study-circle-pending-v1:${account}`;
  const clone=v=>JSON.parse(JSON.stringify(v));
  function loadAccount(){
    const key=accountId(); if(account===key)return;
    account=key;pending={};nextAttempt=0;clearTimeout(retryTimer);
    Object.assign(ui,initialUI());
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
    return [...mine.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')),...C.posts.map(p=>({...p,edition:p.edition||C.archiveEdition}))];
  }
  function hash(s){let n=0;for(const c of s)n=(Math.imul(n,31)+c.charCodeAt(0))|0;return n>>>0;}
  function filtered(){
    const prefs=preferences(),q=ui.query.trim().toLocaleLowerCase();
    let list=allPosts().filter(p=>{
      const s=entry('state-'+p.id);
      if(ui.view==='saved'&&!s.saved)return false;
      if(ui.view==='mine'&&!p.mine)return false;
      if(['for-you','all'].includes(ui.view)&&(s.hidden||!prefs.includes(p.topic)))return false;
      if(ui.view==='for-you'&&(p.mine||p.edition!==C.edition))return false;
      if(ui.unread&&s.read)return false;
      if(ui.topic!=='all'&&p.topic!==ui.topic)return false;
      return !q||[p.title,p.body,p.takeaway,p.code,topic(p.topic).name].join(' ').toLocaleLowerCase().includes(q);
    });
    if(['for-you','all'].includes(ui.view)){
      // Keep actual editorial editions separate; rotating is not a new publication.
      const editions=[...new Set(list.map(p=>p.mine?(p.createdAt||'').slice(0,10):p.edition))].sort().reverse();
      list=editions.flatMap(date=>{
        const batch=list.filter(p=>(p.mine?(p.createdAt||'').slice(0,10):p.edition)===date);
        const buckets=C.topics.map(t=>{
          const group=batch.filter(p=>p.topic===t.id).sort((a,b)=>hash(a.id)-hash(b.id));
          const shift=group.length?ui.seed%group.length:0;
          return [...group.slice(shift),...group.slice(0,shift)];
        });
        const result=[];for(let i=0;result.length<batch.length;i++)for(let k=0;k<buckets.length;k++){
          const group=buckets[(k+ui.seed)%buckets.length];if(group[i])result.push(group[i]);
        }
        return result;
      });
    }
    return list;
  }
  const icon=name=>{
    const paths={heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',save:'M6 3h12v18l-6-4-6 4V3Z',chat:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A9.5 9.5 0 0 1 21 11.5Z',note:'M13 3H5v18h14V9M13 3v6h6M8 13h8M8 17h5',refresh:'M20 7v5h-5M4 17v-5h5M5.7 7a7 7 0 0 1 12-1L20 9M4 15l2.3 3a7 7 0 0 0 12-1',arrow:'M5 12h14M13 6l6 6-6 6',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'};
    return `<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.arrow}"/></svg>`;
  };
  function visual(p){
    const box=(type,inside)=>`<div class="sf-visual sf-v-${type}" aria-label="${h(p.title)}">${inside}</div>`;
    if(p.visual==='routes')return box('routes','<div><span>电脑</span><i>↔</i><span>平板</span><small>直连</small></div><div><span>电脑</span><i>↔</i><b>中转</b><i>↔</i><span>平板</span></div>');
    if(p.visual==='bottleneck')return box('bottleneck','<span>家里上传</span><i>→</i><b>最慢的一段</b><i>→</i><span>外面下载</span>');
    if(p.visual==='inversions')return box('inversions','<div><span>G<br>E<br><b>C</b></span><small>原位</small></div><div><span>C<br>G<br><b>E</b></span><small>第一转位</small></div><div><span>E<br>C<br><b>G</b></span><small>第二转位</small></div>');
    if(p.visual==='passing')return box('passing','<div><span>C</span><i>→</i><span class="sf-passing-tone">D</span><i>→</i><span>E</span></div><b>C — E — G</b><small>和声可以保持，旋律继续走。</small>');
    if(p.visual==='depth')return box('depth','<i></i><i></i><i></i><i></i><i></i><i></i><span>一点远，一点近。</span>');
    if(p.visual==='frames')return box('frames','<div><b>60 FPS</b><span>约 16.7 ms / 帧</span></div><div><b>120 FPS</b><span>约 8.3 ms / 帧</span></div>');
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
  const dateLabel=date=>/^\d{4}-\d{2}-\d{2}$/.test(date||'')?`${Number(date.slice(5,7))}月${Number(date.slice(8,10))}日`:'';
  function avatar(id){
    const shapes={
      python:'<path d="M18 21h19v9H27v13H16V31h10V21"/><circle cx="32" cy="25" r="1"/><path d="M38 39H19v-9h10V17h11v12H30v10" opacity=".45"/>',
      network:'<circle cx="28" cy="28" r="17"/><ellipse cx="28" cy="28" rx="8" ry="17"/><path d="M12 23h32M12 33h32"/>',
      music:'<path d="M23 39V16l19-4v23M23 23l19-4"/><ellipse cx="18" cy="39" rx="6" ry="4"/><ellipse cx="37" cy="35" rx="6" ry="4"/>',
      english:'<path d="m12 39 10-24 10 24M16 31h12M36 28c9-4 11 8 0 7-5 0-3 7 3 4l3-2v-7"/>',
      ai:'<path d="m28 10 5 13 13 5-13 5-5 13-5-13-13-5 13-5Z"/><path d="m43 8 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" opacity=".5"/>',
      visual:'<path d="M10 39 24 18l12 17 7-9 10 16H10Z"/><circle cx="39" cy="16" r="6"/><path d="M11 45h34"/>',
      self:'<path d="M29 43V29M29 34C10 33 11 15 11 15s21-2 18 19ZM29 29C48 28 47 10 47 10S26 8 29 29Z"/>'
    };
    return `<svg viewBox="0 0 56 56" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${shapes[id]||shapes.self}</svg>`;
  }
  function cover(){
    const stars=Array.from({length:48},(_,i)=>`<circle cx="${(i*137+29)%800}" cy="${(i*59+7)%195}" r="${i%7===0?1.3:.65}" opacity="${.25+i%5*.12}"/>`).join('');
    return `<svg class="sf-cover-art" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="月光下的蓝绿色群山与湖面"><defs><linearGradient id="sf-sky" x2="0" y2="1"><stop stop-color="#1b3548"/><stop offset="1" stop-color="#99b7ae"/></linearGradient><linearGradient id="sf-lake" x2="0" y2="1"><stop stop-color="#7c9f99"/><stop offset="1" stop-color="#254f58"/></linearGradient><radialGradient id="sf-moon"><stop stop-color="#eff0ce" stop-opacity=".28"/><stop offset="1" stop-color="#eff0ce" stop-opacity="0"/></radialGradient></defs><path fill="url(#sf-sky)" d="M0 0h800v300H0z"/><circle fill="url(#sf-moon)" cx="593" cy="65" r="80"/><circle fill="#e8ebcc" cx="593" cy="65" r="19"/><g fill="#ebf0dc">${stars}</g><path fill="#6b9290" d="m0 208 92-70 61 34 95-89 109 100 66-51 112 67 94-78 75 74 96-35v140H0Z"/><path fill="#416c72" d="m0 235 110-57 92 38 117-68 95 68 89-40 111 40 96-70 90 60v94H0Z"/><path fill="url(#sf-lake)" d="M0 229q180-8 388 11t412-8v68H0Z"/><g stroke="#d6dfc3" stroke-width="1" opacity=".3"><path d="M558 252h62m-75 7h91m-70 8h47m-71 8h93m-65 9h36"/></g><path fill="#183e49" d="m0 247 79-12 82 21 80 44H0Zm800-3-76-14-107 70h183Z"/><path fill="#d8e1cc" opacity=".15" d="m0 298 120-31 57 33Zm800-15-73-30-50 47h123Z"/></svg>`;
  }
  function card(p){
    const t=topic(p.topic),s=entry('state-'+p.id),r=entry('thought-'+p.id),thought=ui.thought===p.id;
    const text=ui.drafts[p.id]??r.text??'',noteSaved=!!mem.notes?.['circle-'+p.id];
    const action=(name,label,svg,extra='')=>`<button type="button" data-sf-action="${name}" data-sf-id="${h(p.id)}" ${extra}>${icon(svg)}${label}</button>`;
    const isNew=!p.mine&&p.edition===C.edition;
    return `<article class="sf-card" id="sf-card-${h(p.id)}" style="--sf-tone:${t.color}">
      <div class="sf-avatar sf-avatar-${p.mine?'self':t.id}" aria-hidden="true">${avatar(p.mine?'self':t.id)}</div>
      <div class="sf-card-content"><header class="sf-author"><strong>${p.mine?'我':h(t.author)}</strong><span>${h(t.name)}${isNew&&!s.read?' · 新':''}</span></header>
      <div class="sf-post-body"><h3>${h(p.title)}</h3>${p.body.split('\n').map(line=>`<p>${h(line)}</p>`).join('')}${p.code?`<pre><code>${h(p.code)}</code></pre>`:''}${visual(p)}
      ${!p.mine?`<details class="sf-reading" data-sf-expanded="${h(p.id)}" ${ui.expanded[p.id]?'open':''}><summary>展开笔记与来源</summary>
        ${p.takeaway?`<div class="sf-takeaway"><p>${h(p.takeaway)}</p></div>`:''}
        ${p.prompt?`<details class="sf-question" data-sf-detail="${h(p.id)}" ${ui.answers[p.id]?'open':''}><summary>${h(p.prompt)}<span>点开看解释</span></summary><p>${h(p.answer)}</p></details>`:''}
        <div class="sf-sources">${p.sources.length?p.sources.map(([label,url])=>`<a href="${h(url)}" target="_blank" rel="noopener noreferrer">${h(label)} ↗</a>`).join(''):'原创学习方法建议'}</div><small>${h(lessonLabel(p))} · AI 整理，附参考资料</small></details>`:''}</div>
      <div class="sf-card-meta"><span>${p.mine?h(fmt(p.createdAt))+' · 仅自己可见':dateLabel(p.edition)+'整理'}</span>${s.saved?'<span class="sf-saved-mark">已收藏</span>':''}
        ${p.mine?'':action('read',s.read?'✓ 看过':'标为看过','',`class="sf-read" aria-pressed="${!!s.read}"`)}
        <button type="button" class="sf-menu-toggle" data-sf-action="menu" data-sf-id="${h(p.id)}" aria-label="更多操作：${h(p.title)}" aria-expanded="${ui.menu===p.id}">···</button>
        ${ui.menu===p.id?`<div class="sf-card-menu" aria-label="动态操作">${action('like',s.liked?'取消赞':'赞','heart',`aria-pressed="${!!s.liked}" aria-label="${s.liked?'取消喜欢':'喜欢'}：${h(p.title)}"`)}${action('thought','评论','chat',`aria-expanded="${thought}"`)}${action('save',s.saved?'已收藏':'收藏','save',`aria-pressed="${!!s.saved}" aria-label="${s.saved?'取消收藏':'收藏'}：${h(p.title)}"`)}${action('note',noteSaved?'已记入':'记笔记','note',noteSaved?'disabled':'')}${p.mine?'':action('hide','收起这条','')}</div>`:''}</div>
      ${s.liked||r.text?`<div class="sf-social">${s.liked?`<div class="sf-likes">${icon('heart')}<span>我</span></div>`:''}${r.text?`<button type="button" class="sf-thought-saved" data-sf-action="thought" data-sf-id="${h(p.id)}"><b>我：</b><span>${h(r.text)}</span></button>`:''}</div>`:''}
      ${thought?`<form class="sf-thought" data-sf-form="thought" data-sf-id="${h(p.id)}"><label class="sf-sr" for="sf-thought-${h(p.id)}">给自己留一句话</label><textarea id="sf-thought-${h(p.id)}" data-sf-draft="${h(p.id)}" maxlength="1000" rows="2" placeholder="写下自己的想法…">${h(text)}</textarea><div><span>仅自己可见</span><button type="submit">保存想法</button></div></form>`:''}</div>
    </article>`;
  }
  function renderFeed(){
    loadAccount();
    const list=filtered(),all=allPosts(),prefs=preferences();
    const saved=all.filter(p=>entry('state-'+p.id).saved).length;
    const latest=C.posts.filter(p=>p.edition===C.edition),read=latest.filter(p=>entry('state-'+p.id).read).length;
    const hidden=C.posts.filter(p=>entry('state-'+p.id).hidden).length;
    return `<section class="sf-page" aria-label="学习圈"><header class="sf-topbar"><span>五年学习本</span><h2>学习圈</h2><button type="button" data-sf-action="compose" aria-label="写一条学习动态" aria-expanded="${ui.composer}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/></svg></button></header>
      <div class="sf-cover">${cover()}<div class="sf-cover-caption">在自己的节奏里，<br>一点点看见更大的世界。</div><div class="sf-profile"><strong>我的学习日常</strong><div class="sf-profile-avatar">${avatar('self')}</div></div></div>
      <div class="sf-signature">留一点好奇，给今天的自己。</div>
      <div class="sf-disclosure">按你的兴趣编写 · 栏目手记不是他人真实动态</div>
      <div class="sf-toolbar"><nav class="sf-views" aria-label="动态视图">${[['for-you','新一期'],['all','全部'],['saved','收藏'+(saved?' '+saved:'')],['mine','我写的']].map(([id,label])=>`<button type="button" data-sf-view="${id}" aria-pressed="${ui.view===id}">${label}</button>`).join('')}</nav><button type="button" class="sf-interest-toggle" data-sf-action="settings" aria-expanded="${ui.settings}">兴趣设置</button></div>
      ${ui.settings?`<section class="sf-settings"><p>选你想看的主题；取消兴趣不会删除收藏。</p>${C.topics.map(t=>`<label><input type="checkbox" data-sf-interest="${t.id}" ${prefs.includes(t.id)?'checked':''}><span>${h(t.name)}<small>${h(t.why)}</small></span></label>`).join('')}${hidden?`<button type="button" data-sf-action="restore">恢复收起的 ${hidden} 条</button>`:''}</section>`:''}
      <div class="sf-feed-tools"><label class="sf-search">${icon('search')}<input id="sf-search" type="search" value="${h(ui.query)}" placeholder="搜索动态" aria-label="搜索学习动态"></label><button type="button" data-sf-action="unread" aria-pressed="${ui.unread}">${ui.unread?'✓ ':''}只看没看过</button></div>
      <nav class="sf-topic-filters" aria-label="筛选兴趣主题">${[{id:'all',name:'全部主题'},...C.topics].map(t=>`<button type="button" data-sf-topic="${t.id}" aria-pressed="${ui.topic===t.id}">${h(t.name)}</button>`).join('')}</nav>
      ${ui.composer?`<div class="sf-compose"><form data-sf-form="post"><label for="sf-compose-text">这一刻的想法</label><textarea id="sf-compose-text" data-sf-draft="compose" maxlength="2000" rows="4" placeholder="今天学到了什么？只写一两句也可以。">${h(ui.drafts.compose||'')}</textarea><div><label for="sf-compose-topic">主题 <select id="sf-compose-topic">${C.topics.map(t=>`<option value="${t.id}" ${t.id===(ui.drafts.composeTopic||'python')?'selected':''}>${h(t.name)}</option>`).join('')}</select></label><span>仅自己可见</span><button type="submit">发表</button></div></form></div>`:''}
      <p id="sf-notice" class="sf-notice" role="status">${h(ui.notice)}</p>
      <div class="sf-results"><div class="sf-edition"><span>${ui.view==='for-you'?`${dateLabel(C.edition)} · 新整理 ${latest.length} 条`:ui.view==='all'?'所有学习日常':ui.view==='saved'?'留住喜欢的小发现':'自己的小发现'}</span><span>${ui.view==='for-you'?`本期看过 ${read}/${latest.length}`:`${list.length} 条`}</span></div>
      <div class="sf-posts">${list.slice(0,ui.limit).map(card).join('')||`<div class="sf-empty"><b>${ui.query?'还没有找到这个话题':ui.unread?'这组都标为看过啦':ui.view==='saved'?'遇到喜欢的，在 ··· 里收藏':ui.view==='mine'?'点右上角，写一个小发现':'这一组暂时没有动态'}</b><p>${ui.query?'试试 Python、和弦、API，或者清空搜索。':ui.unread?'可以关掉“只看没看过”再翻一遍，或去全部里看看。':'可以换个主题，或留下一条自己的记录。'}</p>${ui.query?'<button type="button" data-sf-action="clear">清空搜索</button>':''}</div>`}</div>
      ${list.length>ui.limit?`<button type="button" class="sf-load-more" data-sf-action="more">继续往下看 ${icon('arrow')}</button>`:list.length?`<div class="sf-end">—— ${ui.view==='for-you'?'这一期先看到这里':'已经到底啦'} ——${ui.view==='for-you'&&ui.topic==='all'&&!ui.query&&!ui.unread?'<button type="button" data-sf-action="read-batch">这一期我看完了 ✓</button>':''}</div>`:''}
      </div><footer class="sf-about"><button type="button" data-sf-action="shuffle">${icon('refresh')}换个顺序</button><p>共 ${C.posts.length} 条 · 最新整理于 ${C.edition}<br>内容手动更新；换顺序不会生成新动态。</p><span id="sf-sync">${h(syncText())}</span></footer></section>`;
  }

  function repaint(selector){render();if(selector)document.querySelector(selector)?.focus({preventScroll:true});}
  function updateSearch(){
    const results=document.querySelector('.sf-results');
    if(!results){repaint('#sf-search');return;}
    // Keep the live input node and its selection/IME session while results change.
    const template=document.createElement('template');template.innerHTML=renderFeed();
    results.innerHTML=template.content.querySelector('.sf-results').innerHTML;
  }
  function changeState(id,field){const state=entry('state-'+id);queue('state-'+id,{...state,type:'state',[field]:!state[field]});ui.menu=null;repaint(`[data-sf-action="menu"][data-sf-id="${id}"]`);}
  function handleClick(e){
    const target=e.target.closest('[data-sf-action],[data-sf-topic],[data-sf-view]');if(!target)return false;
    loadAccount();const d=target.dataset;
    if(d.sfTopic){ui.topic=d.sfTopic;ui.limit=6;ui.notice='';repaint(`[data-sf-topic="${d.sfTopic}"]`);return true;}
    if(d.sfView){ui.view=d.sfView;ui.topic='all';ui.query='';ui.limit=6;ui.menu=null;ui.unread=false;ui.notice='';repaint(`[data-sf-view="${d.sfView}"]`);return true;}
    const p=allPosts().find(p=>p.id===d.sfId),action=d.sfAction;
    if(action==='like'&&p)changeState(p.id,'liked');
    else if(action==='save'&&p)changeState(p.id,'saved');
    else if(action==='menu'&&p){ui.menu=ui.menu===p.id?null:p.id;repaint(`[data-sf-action="menu"][data-sf-id="${p.id}"]`);}
    else if(action==='read'&&p){changeState(p.id,'read');}
    else if(action==='read-batch'){
      for(const post of filtered())if(!post.mine&&post.edition===C.edition&&!entry('state-'+post.id).read)queue('state-'+post.id,{...entry('state-'+post.id),type:'state',read:true});
      ui.notice='这一期已经标为看过。收藏和笔记都还在。';repaint();
    }
    else if(action==='unread'){ui.unread=!ui.unread;ui.limit=6;repaint('[data-sf-action="unread"]');}
    else if(action==='hide'&&p){queue('state-'+p.id,{...entry('state-'+p.id),type:'state',hidden:true});ui.menu=null;ui.notice='这条已收起，可在兴趣设置里恢复。';repaint();}
    else if(action==='thought'&&p){ui.menu=null;ui.thought=ui.thought===p.id?null:p.id;repaint();if(ui.thought)document.getElementById('sf-thought-'+p.id)?.focus();}
    else if(action==='note'&&p){
      const id='circle-'+p.id;if(mem.notes?.[id])return true;
      const note=[p.title,p.body,p.code,p.takeaway?'要点：'+p.takeaway:'',entry('thought-'+p.id).text?'我的想法：'+entry('thought-'+p.id).text:'',...p.sources.map(([label,url])=>label+'：'+url)].filter(Boolean).join('\n\n');
      // Save through a private circle queue first, then the existing note store.
      queue('note-'+p.id,{type:'note-copy',noteId:id,note:{subject:topic(p.topic).subject,text:note,createdAt:now(),source:'学习圈',circlePost:p.id}});
      mem.notes=mem.notes||{};mem.notes[id]=clone(entry('note-'+p.id).note);lsSave();ui.menu=null;ui.notice='已收进「'+(topic(p.topic).subject==='computer'?'电脑':topic(p.topic).subject==='school'?'学校':topic(p.topic).subject==='ielts'?'英语':'AI')+'」笔记；课程进度不变。';repaint();
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
    if(e.target.id==='sf-search'&&!e.isComposing){ui.query=e.target.value;ui.limit=6;updateSearch();}
  });
  document.addEventListener('compositionend',e=>{if(e.target.id==='sf-search'){ui.query=e.target.value;ui.limit=6;updateSearch();}});
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
  document.addEventListener('toggle',e=>{const id=e.target.dataset?.sfDetail;if(id)ui.answers[id]=e.target.open;const expanded=e.target.dataset?.sfExpanded;if(expanded)ui.expanded[expanded]=e.target.open;},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui.menu){const id=ui.menu;ui.menu=null;repaint(`[data-sf-action="menu"][data-sf-id="${id}"]`);}});
  return {render:renderFeed,handleClick,afterRender};
})();
