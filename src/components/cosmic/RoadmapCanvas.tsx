import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { STAGES } from '../../data/stages';
import type { StageId } from '../../data/stages';
import type { StageStatus } from '../../store/useOnboarding';

export type RoadmapHandle = { flyTo: (id: StageId, cb?: () => void) => void };

type Props = {
  statuses: Record<StageId, StageStatus>;
  onSelect: (id: StageId) => void;
  panelOpen: boolean;
};

const NODE_Y = 0.6;

function radialTexture(inner: string, outer: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, outer);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function makeGlow(color: string, size: number) {
  const m = new THREE.SpriteMaterial({ map: radialTexture(color, 'rgba(244,114,182,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
}
function makeCrystal(color: number, isLocked: boolean) {
  const group = new THREE.Group();
  // outer holo ring
  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.82, 0.022, 8, 64),
    new THREE.MeshBasicMaterial({ color: isLocked ? 0x1a2f45 : 0xf9a8d4, transparent: true, opacity: isLocked ? 0.28 : 0.82 })
  );
  outerRing.rotation.x = Math.PI / 2; outerRing.position.y = -0.12;
  group.add(outerRing);
  // inner dashed ring
  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.28, 0.018, 8, 48),
    new THREE.MeshBasicMaterial({ color: isLocked ? 0x23405a : 0xf472b6, transparent: true, opacity: isLocked ? 0.18 : 0.42 })
  );
  innerRing.rotation.x = Math.PI / 2; innerRing.rotation.z = Math.PI / 12; innerRing.position.y = -0.08;
  group.add(innerRing);
  // crystal core — octahedron physical
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(isLocked ? 0.62 : 0.74, 0),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: color,
      emissiveIntensity: isLocked ? 0.55 : 1.45,
      metalness: 0.08,
      roughness: 0.18,
      transmission: isLocked ? 0.12 : 0.32,
      thickness: 0.4,
      transparent: true,
      opacity: isLocked ? 0.72 : 0.98,
    })
  );
  crystal.rotation.y = Math.PI / 6;
  group.add(crystal);
  // inner core icosa
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.28, 1),
    new THREE.MeshBasicMaterial({ color: isLocked ? 0x4A6075 : 0xffffff, transparent: true, opacity: isLocked ? 0.35 : 0.85 })
  );
  group.add(core);
  // orbit discs (3)
  const orbits: THREE.Sprite[] = [];
  for (let i = 0; i < 3; i++) {
    const r = 1.05 + i * 0.42;
    const sp = makeGlow(isLocked ? 'rgba(74,96,117,0.22)' : (i === 1 ? 'rgba(244,114,182,0.22)' : 'rgba(139,92,246,0.14)'), r * 1.9);
    (sp.material as THREE.SpriteMaterial).opacity = isLocked ? 0.18 : 0.32 - i * 0.06;
    // store radius for rotation
    (sp as any).orbitR = r;
    (sp as any).orbitSpeed = 0.22 + i * 0.16;
    orbits.push(sp);
    group.add(sp);
  }
  return { group: group as THREE.Group, outerRing, innerRing, crystal, core, orbits };
}
function easeInOutCubic(t: number){ return t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

export const RoadmapCanvas = forwardRef<RoadmapHandle, Props>(function RoadmapCanvas({ statuses, onSelect, panelOpen }, ref){
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const statusesRef = useRef(statuses);
  const panelOpenRef = useRef(panelOpen);
  useEffect(()=>{ onSelectRef.current=onSelect; },[onSelect]);
  useEffect(()=>{ statusesRef.current=statuses; },[statuses]);
  useEffect(()=>{ panelOpenRef.current=panelOpen; },[panelOpen]);

  const flyToRef = useRef<((id: StageId, cb?: () => void)=>void) | null>(null);
  useImperativeHandle(ref, ()=>({ flyTo: (id, cb)=> flyToRef.current?.(id, cb) }), []);

  useEffect(()=>{
    const canvas=canvasRef.current, wrap=wrapRef.current;
    if(!canvas||!wrap) return;
    const isMobile = wrap.clientWidth < 760;
    const isLow = (typeof navigator !== 'undefined' && ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || ((navigator as any).deviceMemory && (navigator as any).deviceMemory <= 4))) || isMobile;
    const renderer=new THREE.WebGLRenderer({canvas, antialias:true, powerPreference: isLow ? 'low-power' : 'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, isLow ? 1.35 : 2));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
    const labelRenderer=new CSS2DRenderer(); labelRenderer.setSize(wrap.clientWidth, wrap.clientHeight);
    labelRenderer.domElement.style.position='absolute'; labelRenderer.domElement.style.inset='0'; labelRenderer.domElement.style.pointerEvents='none';
    wrap.appendChild(labelRenderer.domElement);
    const scene=new THREE.Scene(); scene.background=new THREE.Color(0x0b0719); scene.fog=new THREE.FogExp2(0x0b0719,0.014);
    // chain center differs for mobile vertical
    const chainCenter = isMobile ? new THREE.Vector3(0,0,0.2) : new THREE.Vector3(-0.6,0,-2.0);
    const camera=new THREE.PerspectiveCamera(isMobile? 48:44, wrap.clientWidth/wrap.clientHeight,0.1,260);
    const camIntroFrom=new THREE.Vector3(isMobile? 2:18, isMobile? 16:13, isMobile? 10:14);
    const camTop=new THREE.Vector3(chainCenter.x, isMobile? 16:13.5, chainCenter.z + (isMobile? 0.8:0.6));
    const targetIntro=new THREE.Vector3(isMobile? 0:6,0, isMobile? -4:-2.2);
    const targetTop=chainCenter.clone();
    camera.position.copy(camIntroFrom);
    let camPos=camIntroFrom.clone(); let camTarget=targetIntro.clone();
    let introT=0, introDone=false;
    scene.add(new THREE.AmbientLight(0x88b4d4,1.6));
    const dir=new THREE.DirectionalLight(0xcfeaff,1.15); dir.position.set(6,12,8); scene.add(dir);
    scene.add(new THREE.HemisphereLight(0xf472b6,0x0a0f1e,0.5));
    const nodeLight=new THREE.PointLight(0xf472b6,28,22,1.8); nodeLight.position.set(-4,3,-0.6); scene.add(nodeLight);

    const starCount = isLow ? 520 : 900;
    const starGeo=new THREE.BufferGeometry(); const starPos=new Float32Array(starCount*3);
    for(let i=0;i<starCount;i++){ const r=55+Math.random()*90, th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1); starPos[i*3]=r*Math.sin(ph)*Math.cos(th); starPos[i*3+1]=r*Math.sin(ph)*Math.sin(th); starPos[i*3+2]=r*Math.cos(ph);}
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos,3));
    const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x9fd8ff,size: isLow?1.0:1.15,sizeAttenuation:true,transparent:true,opacity:0.72,fog:false})); scene.add(stars);
    function nebula(color:string,x:number,y:number,z:number,s:number,o:number){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:radialTexture(color,'rgba(139,92,246,0)'),transparent:true,opacity:o,blending:THREE.AdditiveBlending,depthWrite:false,fog:false})); sp.position.set(x,y,z); sp.scale.set(s,s,1); scene.add(sp);}
    nebula('rgba(244,114,182,0.26)',-14,7,-30,42, isLow?0.36:0.48); nebula('rgba(139,92,246,0.18)',16,10,-26,40, isLow?0.30:0.42);
    if(!isLow){ nebula('rgba(139,92,246,0.11)',8,-6,-32,48,0.36); nebula('rgba(249,168,212,0.15)',-4,12,-34,34,0.36); }
    const gridSize = isMobile ? 42 : 74;
    const grid=new THREE.GridHelper(gridSize, isMobile? 36:74, 0x3b1f5a,0x1e1b4b); grid.position.y=-0.5; (grid.material as any).transparent=true; (grid.material as any).opacity= isMobile? 0.28:0.34; scene.add(grid);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.MeshBasicMaterial({color:0x0b0719,transparent:true,opacity:0.38})); ground.rotation.x=-Math.PI/2; ground.position.y=-0.52; scene.add(ground);

    const NODE_DEFS: { id: StageId; x: number; z: number; title: string }[] = isMobile ? [
      { id: 1, x: 0, z: -5.6, title: STAGES[0].title },
      { id: 2, x: 0.55, z: -2.8, title: STAGES[1].title },
      { id: 3, x: -0.48, z: 0.0, title: STAGES[2].title },
      { id: 4, x: 0.52, z: 2.9, title: STAGES[3].title },
      { id: 5, x: 0, z: 5.8, title: STAGES[4].title },
    ] : [
      { id: 1, x: -6.6, z: -3.8, title: STAGES[0].title },
      { id: 2, x: -3.6, z: -0.7, title: STAGES[1].title },
      { id: 3, x: -1.1, z: -3.4, title: STAGES[2].title },
      { id: 4, x: 1.7, z: -0.8, title: STAGES[3].title },
      { id: 5, x: 4.9, z: -3.0, title: STAGES[4].title },
    ];

    const pointPos=NODE_DEFS.map(d=>new THREE.Vector3(d.x,NODE_Y,d.z));
    const curve=new THREE.CatmullRomCurve3(pointPos,false,'catmullrom',0.9);
    const computeCurrent=()=>{ const s=statusesRef.current; const keys=Object.keys(s).map(Number) as StageId[]; const first=keys.find(k=>s[k]==='locked'); return first? Number(first):5; };
    const currentIndex=computeCurrent(); const activeT=Math.max(0,Math.min(1,currentIndex/5));
    const dimPts=curve.getPoints(260);
    const dimLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(dimPts),new THREE.LineBasicMaterial({color:0x2a1f45,transparent:true,opacity:0.9})); scene.add(dimLine);
    let actLine:THREE.Line|null=null; if(activeT>0){ const total=curve.getPoints(260); const cnt=Math.max(2,Math.floor(total.length*activeT)); const pts=total.slice(0,cnt); actLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xf472b6,transparent:true,opacity:0.92})); scene.add(actLine); }
    const Np=isLow ? 72 : 120; const pGeo=new THREE.BufferGeometry(); const pPos=new Float32Array(Np*3); pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3)); const pMat=new THREE.PointsMaterial({color:0x9be8ff,size:0.09,sizeAttenuation:true,transparent:true,opacity:0.92,blending:THREE.AdditiveBlending,depthWrite:false}); const pnt=new THREE.Points(pGeo,pMat); scene.add(pnt);
    const comet=new THREE.Group(); const core=new THREE.Mesh(new THREE.SphereGeometry(0.16,16,16),new THREE.MeshBasicMaterial({color:0xdffbff})); const cg=makeGlow('rgba(249,168,212,0.9)',1.45); comet.add(core,cg); scene.add(comet); const cometT0=Math.max(0,activeT-0.02);

    const nodeGroups:THREE.Group[]=[]; const hitSpheres:THREE.Mesh[]=[]; const crystals:THREE.Mesh[]=[]; const outerRings:THREE.Mesh[]=[]; const innerRings:THREE.Mesh[]=[]; const orbitGroups: THREE.Group[] = [];
    for(let i=0;i<NODE_DEFS.length;i++){
      const d=NODE_DEFS[i]; const st=statusesRef.current[d.id];
      const isLocked = st==='locked';
      const g=new THREE.Group(); g.position.set(d.x,NODE_Y,d.z); g.userData.stageId=d.id;
      const col= st==='done'?0xc084fc: st==='current'?0xf472b6:0x2a3a4a;
      const { group: crystalGroup, outerRing, innerRing, crystal, orbits } = makeCrystal(col, isLocked);
      // crystalGroup contains everything at 0,0,0 relative to g, we add its children directly
      crystalGroup.children.slice().forEach(c=> g.add(c));
      outerRings.push(outerRing); innerRings.push(innerRing); crystals.push(crystal);
      // orbit container for rotation
      const orbitContainer = new THREE.Group(); orbits.forEach(o=> orbitContainer.add(o)); g.add(orbitContainer); orbitGroups.push(orbitContainer);
      // keep orbits for animation reference
      (g as any).orbits = orbits;
      // beam for current
      if(st==='current'){ const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.36,4.8,12,1,true),new THREE.MeshBasicMaterial({color:0xf472b6,transparent:true,opacity:0.28,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})); beam.position.y=2.6; g.add(beam); }
      if(isLocked){ const fow=new THREE.Sprite(new THREE.SpriteMaterial({map:radialTexture('rgba(255,255,255,0.07)','rgba(0,0,0,0)'),transparent:true,opacity:0.88,depthWrite:false})); fow.position.y=0.02; fow.scale.set(3.4,3.4,1); g.add(fow); }
      const hit=new THREE.Mesh(new THREE.SphereGeometry(1.45,12,12),new THREE.MeshBasicMaterial({visible:false})); hit.userData.stageId=d.id; g.add(hit); hitSpheres.push(hit);
      // keep crystal for hover scaling
      (hit as any).crystal = crystal;
      const el=document.createElement('div'); el.className='el '+(st==='done'?'done': st==='current'?'cur':'lock'); const statusText= st==='done'?'✓ Выполнено': st==='current'?'● Выполняешь':'🔒 Закрыто'; const stage=STAGES.find(s=>s.id===d.id)!; el.innerHTML=`<div class="se">ЭТАП 0${d.id}</div><div class="nm">${stage.title}</div><div class="st">${statusText}</div>`; const label=new CSS2DObject(el); label.position.set(0,2.45,0); g.add(label);
      scene.add(g); nodeGroups.push(g);
    }

    const composer=new EffectComposer(renderer); composer.addPass(new RenderPass(scene,camera)); const bloom=new UnrealBloomPass(new THREE.Vector2(wrap.clientWidth,wrap.clientHeight),1.08,0.5,0.22); composer.addPass(bloom);

    // top-view orbit — comfortable
    let yaw=0, pitch=0, targetYaw=0, targetPitch=0, dist=isMobile? 16:14, targetDist=isMobile? 16:14;
    let velYaw=0, velPitch=0; const baseYaw=0, basePitch= isMobile? 0.92:0.78; yaw=baseYaw; pitch=basePitch; targetYaw=yaw; targetPitch=pitch;
    let hoverId: StageId|null=null; const pointers=new Map<number,{x:number,y:number}>();
    let pinchDist=0, lastMidX=0, lastMidY=0, hasMoved=false, downX=0, downY=0;
    const raycaster=new THREE.Raycaster(), mouse=new THREE.Vector2();
    const updateHover=(x:number,y:number)=>{
      if(pointers.size>0) return;
      const rect=wrap.getBoundingClientRect(); mouse.x=((x-rect.left)/rect.width)*2-1; mouse.y=-((y-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse,camera); const hits=raycaster.intersectObjects(hitSpheres,false);
      const nid=(hits[0]?.object as any)?.userData?.stageId as StageId|undefined || null;
      if(nid!==hoverId){ hoverId=nid; wrap.style.cursor=nid?'pointer':(pointers.size?'grabbing':'grab');
        hitSpheres.forEach((h,i)=>{
          const isActive = (h.userData.stageId===nid);
          crystals[i].scale.setScalar(isActive?1.10:1);
          (crystals[i].material as any).emissiveIntensity = isActive? 1.9 : (statusesRef.current[ NODE_DEFS[i].id ]==='locked'?0.55:1.45);
        });
      }
    };
    const getMidAndDist=()=>{ const pts=[...pointers.values()]; if(pts.length<2) return null; const dx=pts[0].x-pts[1].x, dy=pts[0].y-pts[1].y; return { dist: Math.hypot(dx,dy), midX:(pts[0].x+pts[1].x)/2, midY:(pts[0].y+pts[1].y)/2 }; };
    const onPointerDown=(e:PointerEvent)=>{ pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); (e.target as Element).setPointerCapture(e.pointerId); if(pointers.size===1){ downX=e.clientX; downY=e.clientY; hasMoved=false; } if(pointers.size===2){ const m=getMidAndDist(); if(m){ pinchDist=m.dist; lastMidX=m.midX; lastMidY=m.midY; } } wrap.style.cursor='grabbing'; };
    const onPointerMove=(e:PointerEvent)=>{
      if(!pointers.has(e.pointerId)){ if(pointers.size===0) updateHover(e.clientX,e.clientY); return; }
      const prev=pointers.get(e.pointerId)!; const dx=e.clientX-prev.x, dy=e.clientY-prev.y; pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(!hasMoved && Math.hypot(e.clientX-downX,e.clientY-downY)>6) hasMoved=true;
      if(pointers.size===2){ const m=getMidAndDist(); if(!m) return; const dDist=m.dist - pinchDist; targetDist=THREE.MathUtils.clamp(targetDist - dDist*0.02, isMobile?10:8.5, 22); pinchDist=m.dist; const mdx=m.midX-lastMidX, mdy=m.midY-lastMidY; const panSpeed=0.008*(dist/12); camTarget.x -= mdx*panSpeed; camTarget.z -= mdy*panSpeed; camTarget.x=THREE.MathUtils.clamp(camTarget.x,-8,7); camTarget.z=THREE.MathUtils.clamp(camTarget.z,-6,6); lastMidX=m.midX; lastMidY=m.midY; return; }
      if(pointers.size===1){
        const isPan=(e as any).shiftKey || (e as any).altKey;
        if(isPan){ const panSpeed=0.01*(dist/12); camTarget.x-=dx*panSpeed; camTarget.z-=dy*panSpeed; camTarget.x=THREE.MathUtils.clamp(camTarget.x,-8,7); camTarget.z=THREE.MathUtils.clamp(camTarget.z,-6,6);
        } else { const rotSpeed=wrap.clientWidth<600?0.006:0.004; targetYaw-=dx*rotSpeed; targetPitch=THREE.MathUtils.clamp(targetPitch - dy*rotSpeed,0.28,1.22); velYaw=-dx*rotSpeed*0.6; velPitch=-dy*rotSpeed*0.6; }
      }
    };
    const onPointerUp=(e:PointerEvent)=>{ pointers.delete(e.pointerId); if(pointers.size===1){ const m=getMidAndDist(); if(m){ pinchDist=m.dist; lastMidX=m.midX; lastMidY=m.midY; } } if(pointers.size===0) wrap.style.cursor=hoverId?'pointer':'grab'; };
    const onWheel=(e:WheelEvent)=>{ e.preventDefault(); const d=e.deltaY*(e.deltaMode===1?16:1)*0.008; targetDist=THREE.MathUtils.clamp(targetDist + d, isMobile?10:8.5, 22); };
    const onClick=(e:MouseEvent)=>{
      if(introT<1 || hasMoved) return;
      const rect=wrap.getBoundingClientRect(); mouse.x=((e.clientX-rect.left)/rect.width)*2-1; mouse.y=-((e.clientY-rect.top)/rect.height)*2+1; raycaster.setFromCamera(mouse,camera); const hits=raycaster.intersectObjects(hitSpheres,false);
      if(hits.length){ const id=(hits[0].object as any).userData.stageId as StageId; const g=nodeGroups.find(g=>g.userData.stageId===id); if(g){ const burst=new THREE.Mesh(new THREE.TorusGeometry(1.05,0.05,8,32),new THREE.MeshBasicMaterial({color:0xf9a8d4,transparent:true,opacity:0.9})); burst.rotation.x=Math.PI/2; burst.position.copy(g.position); burst.position.y=0.35; scene.add(burst); let bt=0; const bLoop=()=>{ bt+=0.016/0.3; burst.scale.setScalar(1+bt*1.7); (burst.material as any).opacity=0.9*(1-bt); if(bt<1) requestAnimationFrame(bLoop); else scene.remove(burst); }; bLoop(); } onSelectRef.current(id); }
    };
    wrap.addEventListener('pointerdown',onPointerDown); wrap.addEventListener('pointermove',onPointerMove);
    wrap.addEventListener('pointerup',onPointerUp); wrap.addEventListener('pointercancel',onPointerUp);
    wrap.addEventListener('click',onClick); wrap.addEventListener('wheel',onWheel,{passive:false});
    wrap.style.cursor='grab'; wrap.style.touchAction='none';

    // flyTo with cyberpunk trail
    let flightActive=false;
    flyToRef.current = (id: StageId, cb?: ()=>void) => {
      const node=NODE_DEFS.find(n=>n.id===id); if(!node) { cb?.(); return; }
      flightActive=true;
      const fromTar=camTarget.clone(), fromPos=camPos.clone();
      const toTar=new THREE.Vector3(node.x,0,node.z);
      const toPos=new THREE.Vector3(node.x, 11, node.z+5.5);
      const trailPts=[]; const segs=28; for(let i=0;i<=segs;i++){ const t=i/segs; const p=new THREE.Vector3().lerpVectors(fromTar, toTar, t); p.y=0.02; trailPts.push(p); }
      const trailGeo=new THREE.BufferGeometry().setFromPoints(trailPts);
      const trailMat=new THREE.LineBasicMaterial({ color:0xf472b6, transparent:true, opacity:0.9 });
      const trail=new THREE.Line(trailGeo, trailMat); scene.add(trail);
      const scan=makeGlow('rgba(244,114,182,0.95)', 2.6); scan.position.copy(fromTar); scan.position.y=0.06; scene.add(scan);
      let ft=0; const dur=1.1;
      const tick=()=>{
        ft+=0.016/dur;
        if(ft>=1){
          camTarget.copy(toTar); camPos.copy(toPos);
          bloom.strength=1.08; scene.remove(trail); scene.remove(scan); trailGeo.dispose(); (trailMat as any).dispose();
          const g=nodeGroups.find(g=>g.userData.stageId===id); if(g){ const cr = crystals[NODE_DEFS.findIndex(n=>n.id===id)]; (cr.material as any).emissiveIntensity=2.8; setTimeout(()=> (cr.material as any).emissiveIntensity=1.45, 180); }
          flightActive=false; cb?.(); return;
        }
        const k=easeInOutCubic(ft);
        camTarget.lerpVectors(fromTar, toTar, k);
        camPos.lerpVectors(fromPos, toPos, k);
        scan.position.lerpVectors(fromTar, toTar, k);
        trailMat.opacity=0.9*(1-ft);
        bloom.strength=1.08 + Math.sin(ft*Math.PI)*0.55;
        requestAnimationFrame(tick);
      };
      tick();
    };

    const onResize=()=>{ const w=wrap.clientWidth,h=wrap.clientHeight; camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h); labelRenderer.setSize(w,h); composer.setSize(w,h); };
    const ro=new ResizeObserver(onResize); ro.observe(wrap);
    const clock=new THREE.Clock(); let raf=0;
    const render=()=>{
      const dt=clock.getDelta();
      if(!introDone){ introT=Math.min(1, introT+ dt/1.4); const k=easeInOutCubic(introT); camPos.lerpVectors(camIntroFrom, camTop, k); camTarget.lerpVectors(targetIntro, targetTop, k); if(introT>=1) introDone=true;
      } else if(!flightActive){
        if(pointers.size===0 && (Math.abs(velYaw)>0.0001||Math.abs(velPitch)>0.0001)){ targetYaw+=velYaw; targetPitch=THREE.MathUtils.clamp(targetPitch+velPitch,0.28,1.22); velYaw*=0.92; velPitch*=0.92; if(Math.abs(velYaw)<0.0003) velYaw=0; if(Math.abs(velPitch)<0.0003) velPitch=0; }
        yaw+=(targetYaw-yaw)*0.10; pitch+=(targetPitch-pitch)*0.10; dist+=(targetDist-dist)*0.10;
        const cy=Math.cos(yaw), sy=Math.sin(yaw); const sp=Math.sin(pitch), cp=Math.cos(pitch);
        camPos.set(camTarget.x + sy*dist*cp, 8.2 + sp*6, camTarget.z + cy*dist*cp);
      }
      camera.position.copy(camPos); camera.lookAt(camTarget);
      const t=clock.getElapsedTime();
      // rotate crystals and orbits
      crystals.forEach((cr,i)=>{ cr.rotation.y += 0.008 + i*0.002; cr.rotation.x = Math.sin(t*0.5 + i)*0.08; });
      innerRings.forEach((r,i)=>{ r.rotation.z += 0.004 + i*0.001; });
      outerRings.forEach((r)=>{ r.rotation.z -= 0.006; });
      orbitGroups.forEach((og,i)=>{ og.rotation.y += 0.005 + i*0.003; });
      for(let i=0;i<Np;i++){ const tt=((i/Np)+t*0.06)%1; const p=curve.getPointAt(tt); pPos[i*3]=p.x; pPos[i*3+1]=p.y+Math.sin(t*3+i)*0.02; pPos[i*3+2]=p.z; }
      (pnt.geometry.attributes.position as THREE.BufferAttribute).needsUpdate=true;
      const ct=(cometT0+t*0.012)%Math.max(0.05,activeT);
      if(activeT>0){ const cp=curve.getPointAt(Math.min(ct,activeT)); comet.position.copy(cp); const tang=curve.getTangentAt(Math.min(ct,activeT)); comet.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tang); comet.visible=true; } else comet.visible=false;
      nodeGroups.forEach((g,i)=>{ const ring=outerRings[i]; if(ring) ring.scale.setScalar(1+Math.sin(t*2.0+g.position.x)*0.05); });
      composer.render(); labelRenderer.render(scene,camera);
    };
    const loop=()=>{ if(document.hidden){ raf=requestAnimationFrame(loop); return;} render(); raf=requestAnimationFrame(loop); };
    render(); loop();
    return ()=>{
      cancelAnimationFrame(raf); ro.disconnect();
      wrap.removeEventListener('pointerdown',onPointerDown); wrap.removeEventListener('pointermove',onPointerMove);
      wrap.removeEventListener('pointerup',onPointerUp); wrap.removeEventListener('click',onClick); wrap.removeEventListener('wheel',onWheel);
      try{ wrap.removeChild(labelRenderer.domElement);}catch{}
      starGeo.dispose(); (stars.material as THREE.Material).dispose(); pGeo.dispose(); (pMat as THREE.Material).dispose();
      (dimLine.geometry as THREE.BufferGeometry).dispose(); if(actLine) (actLine.geometry as THREE.BufferGeometry).dispose();
      renderer.dispose(); composer.dispose();
    };
  },[]);
  return <div ref={wrapRef} style={{position:'relative',width:'100%',height:'100%',minHeight:560,overflow:'hidden',borderRadius:18}}><canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',display:'block'}}/></div>;
});
