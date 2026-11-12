/* One card per work, with the original resource records kept intact. */
const OperaLibrary = (() => {
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase()
    .replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
  function aliases(op) {
    const keys = [op.name, op.ru, op.orig].filter(Boolean);
    for (const [text, quote] of [[op.ru, /«([^»]+)»/g], [op.name, /《([^》]+)》/g]]) {
      if (!text) continue;
      const composer = text.split(/[«《]/)[0].trim();
      for (const match of text.matchAll(quote)) keys.push(composer + match[1]);
    }
    return [...new Set(keys.map(normalize).filter(Boolean))];
  }
  function build(catalog, entries, states = {}) {
    const groups = catalog.map(p => ({p:p.p, t:p.t || '', ops:p.ops.map(([id,name,hint,ru,orig]) =>
      ({id,name,hint,ru,orig,resources:[]}))}));
    const cards = groups.flatMap(p => p.ops), byId = new Map(cards.map(o => [o.id,o]));
    const lookup = new Map(), composers = new Map();
    function register(op) {
      for (const key of aliases(op)) {
        if (!lookup.has(key)) lookup.set(key, op);
        else if (lookup.get(key) !== op) lookup.set(key, null); // Ambiguous titles stay separate.
      }
    }
    for (const group of groups) for (const op of group.ops) {
      register(op);
      const composer = (op.ru || '').split('«')[0].trim();
      if (composer) composers.set(normalize(composer), group);
    }
    for (const [composer, period] of [['Бетховен','古典'],['Беллини','浪漫'],['Доницетти','浪漫'],['Бородин','俄罗斯线'],['Даргомыжский','俄罗斯线'],['Прокофьев','二十世纪']]) {
      composers.set(normalize(composer), groups.find(g => g.p === period));
    }
    const ordered = [...entries].sort((a,b) => Number((a[1].area || '').startsWith('resource-')) - Number((b[1].area || '').startsWith('resource-')));
    for (const [cid, course] of ordered) {
      const title = String(course.title || '').trim();
      let op = byId.get(course.area) || lookup.get(normalize(title));
      // The old Monteverdi resource has its work name at the start of its note.
      const noteTitle = String(course.note || '').match(/^\s*«([^»]+)»/);
      if (!op && noteTitle) op = lookup.get(normalize(title + noteTitle[1]));
      if (!op) {
        const composer = normalize(title.split(/[«《:：]/)[0]);
        let group = composers.get(composer);
        if (!group) {
          group = groups.find(g => g.p === '补充歌单');
          if (!group) { group = {p:'补充歌单',t:'自己添加的作品与资源',ops:[]}; groups.push(group); }
        }
        op = {id:'resource-' + encodeURIComponent(normalize(title) || cid),name:title || '未命名资源',hint:'',ru:'',orig:'',resources:[]};
        group.ops.push(op); byId.set(op.id,op); register(op);
      }
      op.resources.push([cid,course]);
    }
    for (const op of groups.flatMap(g => g.ops)) {
      const state = states[op.id] || {};
      op.done = typeof state.done === 'boolean' ? state.done : op.resources.some(([,c]) => c.status === 'done');
    }
    return groups;
  }
  return {build};
})();
