// Generates small test records and checks that every mesh is closed (watertight) with consistent orientation.
// Usage: node test/mesh-check.js
const {prepare,genMesh,countTris}=require(require('path').join(__dirname,'../src/core.js'));
function run(stereo,N,secs){
 const rpm=45, fs=N*rpm/60, n=Math.round(secs*fs);
 const L=new Float32Array(n),R=new Float32Array(n);
 for(let i=0;i<n;i++){L[i]=Math.sin(i*0.3)+0.3*Math.random();R[i]=Math.sin(i*0.17)*0.5;}
 const P={N,stereo,hpHz:fs*0.02,lpHz:fs*0.42,compress:true,riaa:true,grooveW:0.16,land:0.04,ampMax:0.06,autoFit:true,
   rStart:84,rMin:53,pitchIn:1.5,pitchOut:2,maxSlope:0.7,vertFrac:0.5,rpm,thick:2,diam:175,rHole:3.62};
 const {G,stats}=prepare([L,R],fs,P);
 const chunks=[]; const tot=genMesh(G,1000,c=>chunks.push(new Uint8Array(c)));
 const buf=Buffer.concat(chunks); const dv=new DataView(buf.buffer,buf.byteOffset,buf.length);
 const m=new Map(); let vol=0, bad=0;
 const key=(o)=>dv.getUint32(o,true)+','+dv.getUint32(o+4,true)+','+dv.getUint32(o+8,true);
 for(let t=0;t<tot;t++){const o=t*50;const k=[key(o+12),key(o+24),key(o+36)];
  if(k[0]===k[1]||k[1]===k[2]||k[0]===k[2])bad++;
  for(let e=0;e<3;e++){const d=k[e]+'>'+k[(e+1)%3];m.set(d,(m.get(d)||0)+1);}
  const p=[0,1,2].map(e=>[dv.getFloat32(o+12+e*12,true),dv.getFloat32(o+16+e*12,true),dv.getFloat32(o+20+e*12,true)]);
  vol+=(p[0][0]*(p[1][1]*p[2][2]-p[1][2]*p[2][1])-p[0][1]*(p[1][0]*p[2][2]-p[1][2]*p[2][0])+p[0][2]*(p[1][0]*p[2][1]-p[1][1]*p[2][0]))/6;}
 let dup=0,open=0;for(const [d,c] of m){if(c>1)dup++;const [a,b]=d.split('>');if(!m.has(b+'>'+a))open++;}
 const ideal=Math.PI*(87.5**2-3.62**2)*2;
 if(dup||open||bad||tot!==countTris(N,stats.M)||!(vol>0)){process.exitCode=1;console.log('FAIL');}else console.log('OK');
 console.log({stereo,tot,expect:countTris(N,stats.M),degenerate:bad,dupEdges:dup,openEdges:open,vol:vol.toFixed(1),discVol:ideal.toFixed(1),A:stats.A,limited:stats.limitedBy});
}
run(false,400,8);run(true,640,6);run(true,370,3);
