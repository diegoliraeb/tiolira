'use client';
import {useEffect,useRef} from 'react';

export default function MovementWaves({enabled=false,variant='hero'}){
 const canvas=useRef(null);
 useEffect(()=>{
  const element=canvas.current,ctx=element.getContext('2d');
  if(!ctx)return;
  let width=0,height=0,time=0,last=0,raf=0,visible=true,mx=.5,my=.5;
  const club=variant==='club';
  function draw(){
   if(!width||!height)return;
   ctx.clearRect(0,0,width,height);
   const h=height,w=width,band=club?h*.5:Math.min(h*.25,190);
   const colors=club?['#45513b','#536044','#65704f','#75805d','#8d8461','#a66a46','#bf7a50']:['#e4d8bc','#e9dfc9','#f4ead5','#d8c4a0','#e5d3b3','#f3e4c9','#bb7551','#c58962','#ad603e','#61704b','#48583a','#35472e'];
   colors.forEach((color,n)=>{
    const phase=time*.65+n*.13,lift=Math.sin(phase)*19+Math.cos(phase*.63)*14,base=h-band+n*band/(colors.length+1);
    ctx.beginPath();ctx.moveTo(-10,h+10);ctx.lineTo(-10,base-25+lift);
    ctx.bezierCurveTo(w*.16,base-band*.75+Math.sin(phase+.9)*35,w*.26,base+band*.8+my*10,w*.52,base+Math.sin(phase+2)*22);
    ctx.bezierCurveTo(w*.72+mx*15,base-band*.7+Math.cos(phase)*40,w*.88,base+band*.3,w+10,base-band*.35+Math.sin(phase+1)*30);
    ctx.lineTo(w+10,h+10);ctx.closePath();ctx.fillStyle=color;ctx.shadowColor='#43341c25';ctx.shadowBlur=7;ctx.shadowOffsetY=-3;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
   });
  }
  function stop(){cancelAnimationFrame(raf);raf=0;last=0;}
  function frame(stamp){raf=0;if(!enabled||!visible||document.hidden)return;if(last)time+=Math.min((stamp-last)/1000,.08);last=stamp;draw();raf=requestAnimationFrame(frame);}
  function run(){stop();if(enabled&&visible&&!document.hidden)raf=requestAnimationFrame(frame);}
  function resize(){const b=element.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);width=b.width;height=b.height;element.width=Math.round(width*d);element.height=Math.round(height*d);ctx.setTransform(d,0,0,d,0,0);draw();}
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;run();},{rootMargin:'100px'});
  const sizeObserver=new ResizeObserver(resize);observer.observe(element);sizeObserver.observe(element);
  const parent=element.parentElement;
  function pointer(e){if(!enabled||e.pointerType==='touch')return;const b=parent.getBoundingClientRect();mx=(e.clientX-b.left)/b.width;my=(e.clientY-b.top)/b.height;}
  parent.addEventListener('pointermove',pointer);document.addEventListener('visibilitychange',run);resize();run();
  return()=>{stop();observer.disconnect();sizeObserver.disconnect();parent.removeEventListener('pointermove',pointer);document.removeEventListener('visibilitychange',run);};
 },[enabled,variant]);
 return <canvas ref={canvas} className={variant==='club'?'v-club-waves':'v-waves'} aria-hidden="true"/>;
}
