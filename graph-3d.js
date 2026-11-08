/* A real XYZ layout with perspective projection. Canvas rendering keeps this
   small graph usable without a CDN, WebGL support, or an always-running loop. */
const NotebookGraph3D = (() => {
  const view={yaw:.48,pitch:-.22,zoom:1.3,panX:0,panY:0,auto:false};
  const layouts=new Map();let active=null;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const initial=()=>Object.assign(view,{yaw:.48,pitch:-.22,zoom:1.3,panX:0,panY:0,auto:false});
  function rotate(p,yaw,pitch) {
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
    const x=p.x*cy+p.z*sy,z=-p.x*sy+p.z*cy;
    return {x,y:p.y*cx-z*sx,z:p.y*sx+z*cx};
  }
  function project(p,camera,width,height,radius) {
    const rotated=rotate(p,camera.yaw,camera.pitch);
    const distance=Math.max(radius,100)*3.05/camera.zoom;
    const depth=distance-rotated.z;
    if(depth<20)return null;
    const focal=Math.min(width,height)*1.12;
    return {x:width/2+rotated.x*focal/depth+camera.panX,y:height/2-rotated.y*focal/depth+camera.panY,
      z:rotated.z,depth,scale:clamp(distance/depth,.48,2.2)};
  }
  function layout(nodes,edges,groups) {
    const key=nodes.map(n=>n.id).join('|');if(layouts.has(key))return layouts.get(key);
    const names=Object.keys(groups),centers=[[-130,90,130],[170,90,-90],[-190,-80,-120],[120,-130,-150],[20,-150,160],[160,90,160]];
    const points=new Map(nodes.map((n,i)=>{const c=centers[names.indexOf(n.group)]||[0,0,0],a=i*2.399963,b=Math.acos(1-2*((i*.61803398875)%1));return[n.id,{x:c[0]+80*Math.sin(b)*Math.cos(a),y:c[1]+80*Math.sin(b)*Math.sin(a),z:c[2]+80*Math.cos(b)}];}));
    for(let pass=0;pass<130;pass++) {
      const force=new Map(nodes.map(n=>[n.id,{x:0,y:0,z:0}]));
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
        const a=points.get(nodes[i].id),b=points.get(nodes[j].id);let dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z;
        const d=Math.hypot(dx,dy,dz)||1,f=Math.min(8,2600/(d*d));
        for(const [axis,v] of [['x',dx],['y',dy],['z',dz]]){force.get(nodes[i].id)[axis]+=v/d*f;force.get(nodes[j].id)[axis]-=v/d*f;}
      }
      for(const edge of edges){const a=points.get(edge.from),b=points.get(edge.to);if(!a||!b)continue;const d=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)||1,f=(d-110)*.013;for(const axis of ['x','y','z']){const delta=(b[axis]-a[axis])/d*f;force.get(edge.from)[axis]+=delta;force.get(edge.to)[axis]-=delta;}}
      for(const n of nodes){const p=points.get(n.id),f=force.get(n.id),center=centers[names.indexOf(n.group)]||[0,0,0];for(const [index,axis] of ['x','y','z'].entries())p[axis]+=f[axis]+(center[index]-p[axis])*.006;}
    }
    const middle={x:0,y:0,z:0};for(const p of points.values())for(const axis of ['x','y','z'])middle[axis]+=p[axis]/Math.max(nodes.length,1);
    let radius=100;for(const p of points.values()){for(const axis of ['x','y','z'])p[axis]-=middle[axis];radius=Math.max(radius,Math.hypot(p.x,p.y,p.z));}
    const result={points,radius};layouts.set(key,result);return result;
  }
  function dispose(){if(active){active.dispose();active=null;}}
  function mount(container,model) {
    dispose();if(!container||!model.nodes.length)return false;
    const canvas=container.querySelector('canvas'),context=canvas?.getContext('2d');if(!context)return false;
    const labels=container.querySelector('.nb-3d-labels'),hud=container.querySelector('.nb-3d-orientation');
    const geometry=layout(model.nodes,model.edges,model.groups),abort=new AbortController(),pointer=new Map();
    let width=1,height=1,frame=0,disposed=false,lastFrame=0,projected=new Map(),edgeSegments=[],start=null,gesture=null,suppressClick=false,dirty=true;
    const labelMap=new Map(),connected=new Set([model.selectedNode]);
    for(const edge of model.edges)if(edge.from===model.selectedNode||edge.to===model.selectedNode){connected.add(edge.from);connected.add(edge.to);}
    for(const node of model.nodes){const button=document.createElement('button');button.type='button';button.className='nb-3d-label';button.dataset.nbNode=node.id;button.setAttribute('aria-label','知识点：'+node.title);button.textContent=node.title;button.style.setProperty('--node-color',model.groups[node.group].color);labels.appendChild(button);labelMap.set(node.id,button);}
    function draw() {
      context.clearRect(0,0,width,height);projected=new Map();edgeSegments=[];
      for(const node of model.nodes){const point=project(geometry.points.get(node.id),view,width,height,geometry.radius);if(point)projected.set(node.id,point);}
      const orderedEdges=[...model.edges].sort((a,b)=>((projected.get(a.from)?.z||0)+(projected.get(a.to)?.z||0))-((projected.get(b.from)?.z||0)+(projected.get(b.to)?.z||0)));
      for(const edge of orderedEdges){const a=projected.get(edge.from),b=projected.get(edge.to);if(!a||!b)continue;const selected=model.selectedEdge===edge.id,near=edge.from===model.selectedNode||edge.to===model.selectedNode;
        context.strokeStyle=selected?'#f2cb8e':near?'#93e7d6':'#6b8baa';context.globalAlpha=selected?1:near?.86:.26;context.lineWidth=selected?2.6:near?1.7:1;
        context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke();
        const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,t=.68,x=a.x+dx*t,y=a.y+dy*t,s=selected?6:4;
        context.fillStyle=context.strokeStyle;context.beginPath();context.moveTo(x+dx/length*s,y+dy/length*s);context.lineTo(x-dx/length*s-dy/length*s*.6,y-dy/length*s+dx/length*s*.6);context.lineTo(x-dx/length*s+dy/length*s*.6,y-dy/length*s-dx/length*s*.6);context.fill();
        edgeSegments.push({edge,a,b});
        if(selected){const text=edge.label;context.globalAlpha=1;context.font='12px "Microsoft YaHei", sans-serif';const size=context.measureText(text).width;context.fillStyle='#0a1725';context.fillRect((a.x+b.x)/2-size/2-6,(a.y+b.y)/2-22,size+12,22);context.fillStyle='#f2d6aa';context.textAlign='center';context.fillText(text,(a.x+b.x)/2,(a.y+b.y)/2-7);}
      }
      const orderedNodes=[...model.nodes].sort((a,b)=>(projected.get(a.id)?.z||0)-(projected.get(b.id)?.z||0));
      for(const node of orderedNodes){const p=projected.get(node.id),button=labelMap.get(node.id);if(!p||p.x<-60||p.x>width+60||p.y<-50||p.y>height+40){button.hidden=true;continue;}button.hidden=false;
        const selected=node.id===model.selectedNode,near=!model.selectedNode||connected.has(node.id),color=model.groups[node.group].color,r=(selected?8:4.5)*clamp(p.scale,.65,1.7);
        const depthOpacity=clamp(.78+(p.scale-1)*.5,.48,1),opacity=near?depthOpacity:depthOpacity*.65;
        context.globalAlpha=opacity;const glow=context.createRadialGradient(p.x,p.y,0,p.x,p.y,r*(selected?4:2.6));glow.addColorStop(0,color);glow.addColorStop(1,'transparent');context.fillStyle=glow;context.beginPath();context.arc(p.x,p.y,r*(selected?4:2.6),0,Math.PI*2);context.fill();
        const sphere=context.createRadialGradient(p.x-r*.35,p.y-r*.4,r*.1,p.x,p.y,r);sphere.addColorStop(0,'#f1fffb');sphere.addColorStop(.35,color);sphere.addColorStop(1,color+'80');context.fillStyle=sphere;context.beginPath();context.arc(p.x,p.y,r,0,Math.PI*2);context.fill();
        if(selected){context.globalAlpha=.9;context.strokeStyle='#d9fff6';context.lineWidth=1.4;context.beginPath();context.arc(p.x,p.y,r+5,0,Math.PI*2);context.stroke();}
        button.style.transform=`translate(${p.x}px,${p.y+r+10}px) translateX(-50%) scale(${clamp(p.scale,.8,1.15)})`;button.style.opacity=String(opacity);button.style.zIndex=String(Math.round(p.z+1000));button.classList.toggle('chosen',selected);
      }
      // Keep labels legible: selected/connected nodes get first choice; rotating
      // reveals labels that were behind others without hiding their sphere.
      const occupied=[];context.font='11px "Microsoft YaHei", sans-serif';
      const labelOrder=[...orderedNodes].sort((a,b)=>{
        const rank=n=>n.id===model.selectedNode?3:connected.has(n.id)?2:1;
        return rank(b)-rank(a)||(projected.get(b.id)?.z||0)-(projected.get(a.id)?.z||0);
      });
      for(const node of labelOrder){const button=labelMap.get(node.id),p=projected.get(node.id);if(!p||button.hidden)continue;
        const factor=clamp(p.scale,.8,1.15),w=(context.measureText(node.title).width+12)*factor,h=20*factor,r=(node.id===model.selectedNode?8:4.5)*clamp(p.scale,.65,1.7);
        const box={left:p.x-w/2,right:p.x+w/2,top:p.y+r+10,bottom:p.y+r+10+h};
        const collision=occupied.some(b=>box.left<b.right+4&&box.right>b.left-4&&box.top<b.bottom+3&&box.bottom>b.top-3);
        button.hidden=collision&&node.id!==model.selectedNode;
        if(!button.hidden)occupied.push(box);
      }
      context.globalAlpha=1;
      if(hud)hud.textContent=`3D · ${Math.round(((view.yaw*180/Math.PI)%360+360)%360)}°`;
      canvas.setAttribute('aria-label','三维知识网；拖动旋转，滚轮或双指缩放。当前旋转角度 '+Math.round(view.yaw*180/Math.PI)+' 度。');
      dirty=false;
    }
    function tick(time){frame=0;if(disposed||!container.isConnected)return;if(document.hidden){lastFrame=0;return;}if(view.auto&&!pointer.size){if(lastFrame)view.yaw+=(time-lastFrame)*.00012;dirty=true;}lastFrame=time;if(dirty)draw();if(view.auto)request();}
    function request(){if(!frame&&!disposed)frame=requestAnimationFrame(tick);}
    function resize(){const rect=container.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);context.setTransform(dpr,0,0,dpr,0,0);dirty=true;request();}
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    const listen=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal:abort.signal});
    const pair=()=>{const [a,b]=[...pointer.values()];return a&&b?{distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2}:null;};
    listen(container,'pointerdown',event=>{if(event.button>2)return;pointer.set(event.pointerId,{x:event.clientX,y:event.clientY});suppressClick=false;start={x:event.clientX,y:event.clientY,moved:false,pan:event.button===2||event.shiftKey,node:event.target.closest('[data-nb-node]')?.dataset.nbNode};if(pointer.size>1)start.moved=true;gesture=pair();container.setPointerCapture(event.pointerId);});
    listen(container,'pointermove',event=>{const previous=pointer.get(event.pointerId);if(!previous)return;const dx=event.clientX-previous.x,dy=event.clientY-previous.y;pointer.set(event.pointerId,{x:event.clientX,y:event.clientY});if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>4)start.moved=true;
      if(pointer.size>1){const next=pair();if(next&&gesture){view.zoom=clamp(view.zoom*next.distance/Math.max(gesture.distance,1),.35,4);view.panX+=next.x-gesture.x;view.panY+=next.y-gesture.y;}gesture=next;}
      else if(start?.pan){view.panX+=dx;view.panY+=dy;}
      else {view.yaw+=dx*.008;view.pitch=clamp(view.pitch+dy*.007,-Math.PI*.48,Math.PI*.48);}dirty=true;request();});
    function pick(event){const rect=container.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      const candidates=[...projected].filter(([,p])=>Math.hypot(p.x-x,p.y-y)<17).sort((a,b)=>b[1].z-a[1].z);
      if(candidates.length){model.onNode(candidates[0][0]);return;}
      const hit=edgeSegments.map(s=>{const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,t=clamp(((x-s.a.x)*dx+(y-s.a.y)*dy)/(dx*dx+dy*dy||1),0,1);return {edge:s.edge,distance:Math.hypot(x-s.a.x-t*dx,y-s.a.y-t*dy)};}).filter(h=>h.distance<7).sort((a,b)=>a.distance-b.distance)[0];
      if(hit)model.onEdge(hit.edge.id);
    }
    listen(container,'pointerup',event=>{const finished=start;pointer.delete(event.pointerId);gesture=pair();if(!pointer.size)start=null;suppressClick=true;event.preventDefault();if(finished&&!finished.moved&&event.button!==2){if(finished.node)model.onNode(finished.node);else pick(event);}});
    listen(container,'pointercancel',()=>{pointer.clear();start=null;gesture=null;});
    listen(container,'click',event=>{if(suppressClick&&event.detail){suppressClick=false;event.preventDefault();event.stopPropagation();}}, {capture:true});
    listen(container,'contextmenu',event=>event.preventDefault());
    listen(container,'wheel',event=>{event.preventDefault();view.zoom=clamp(view.zoom*Math.exp(-event.deltaY*.0014),.35,4);dirty=true;request();},{passive:false});
    listen(container,'keydown',event=>{if(event.target!==canvas)return;const keys={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]};if(keys[event.key]){event.preventDefault();view.yaw+=keys[event.key][0];view.pitch=clamp(view.pitch+keys[event.key][1],-Math.PI*.48,Math.PI*.48);dirty=true;request();}});
    listen(document,'visibilitychange',()=>{if(!document.hidden){lastFrame=0;dirty=true;request();}});
    function syncToggle(){const toggle=document.querySelector('[data-nb-zoom="auto"]');if(toggle){toggle.textContent=view.auto?'停止旋转':'自动旋转';toggle.setAttribute('aria-pressed',String(view.auto));}}
    active={action(name){if(name==='reset')initial();else if(name==='auto')view.auto=!view.auto;else view.zoom=clamp(view.zoom*(name==='in'?1.2:1/1.2),.35,4);lastFrame=0;dirty=true;request();syncToggle();},dispose(){disposed=true;abort.abort();observer.disconnect();if(frame)cancelAnimationFrame(frame);labels.replaceChildren();}};
    syncToggle();
    return true;
  }
  return {mount,dispose,action(name){if(!active)return false;active.action(name);return true;},layout,rotate,project};
})();
