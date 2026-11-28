// RDL SHOP — Node 18+, কোনো প্যাকেজ লাগে না: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const E=process.env,PORT=E.PORT||3000,PASS=E.ADMIN_PASS||'RDL555',DB=E.DB_FILE||'data.json',GID=E.GOOGLE_CLIENT_ID||'';
const seed=[["ওয়্যারলেস ব্লুটুথ হেডফোন","ইলেকট্রনিক্স",1450,2200,25,"🎧",4.5,320],["স্মার্ট ওয়াচ","ইলেকট্রনিক্স",2490,3500,12,"⌚",4.3,210],["পুরুষদের কটন পাঞ্জাবি","ফ্যাশন",1190,1600,40,"👕",4.6,540],["মহিলাদের হ্যান্ডব্যাগ","ফ্যাশন",990,1500,18,"👜",4.4,180],["নন-স্টিক ফ্রাইং প্যান","হোম ও কিচেন",650,900,30,"🍳",4.7,760],["স্পোর্টস রানিং শুজ","ফ্যাশন",1850,2600,15,"👟",4.5,290],["পাওয়ার ব্যাংক ২০০০০mAh","ইলেকট্রনিক্স",1590,2000,50,"🔋",4.6,910],["ফেস ওয়াশ সেট","বিউটি",520,750,60,"🧴",4.2,430]].map((a,i)=>({id:i+1,name:a[0],cat:a[1],price:a[2],old:a[3],stock:a[4],em:a[5],img:'',desc:'আসল ও মানসম্মত পণ্য। ক্যাশ অন ডেলিভারি ও ৭ দিনের রিটার্ন সুবিধা।',rating:a[6],sold:a[7]}));
let D=fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB)):{};
D.products=D.products||seed;D.orders=D.orders||[];D.users=D.users||{};D.sessions=D.sessions||{};
D.coupons=D.coupons||[{code:'RDL10',type:'pct',val:10,min:500,active:true}];D.tickets=D.tickets||[];D.settings=D.settings||{};D.banners=D.banners||[];
const norm=p=>{p.imgs=Array.isArray(p.imgs)?p.imgs:(p.img?[p.img]:[]);delete p.img;delete p.rating;p.reviews=p.reviews||[];p.views=p.views||0;p.carts=p.carts||0;p.type=p.type||'normal';p.featured=!!p.featured;p.cost=p.cost||0;p.rp=p.rp||0;p.video=p.video||'';p.iv=p.iv||1;p.sold=p.sold||0;return p};
function migrate(){D.products.forEach(norm);D.banners=D.banners||[];D.payouts=D.payouts||[];const so={};D.orders.forEach(o=>{if(o.status!=='বাতিল')o.items.forEach(i=>so[i.id]=(so[i.id]||0)+i.n)});D.products.forEach(p=>p.sold=so[p.id]||0)}
migrate();
const UU=E.UPSTASH_REDIS_REST_URL,UT=E.UPSTASH_REDIS_REST_TOKEN,saved={};let dbState={ok:false,msg:(UU&&UT)?'যাচাই হয়নি':'সার্ভার UPSTASH_REDIS_REST_URL / TOKEN পায়নি (Render Environment-এর নাম ও মান দেখুন)'},tm=null,busy=false,again=false,dirty=false;
const rc=async cmd=>{const r=await fetch(UU,{method:'POST',headers:{Authorization:'Bearer '+UT},body:JSON.stringify(cmd)});const j=await r.json();if(j.error)throw new Error(j.error);return j.result};
const blobs=()=>{const m={};D.products.forEach(p=>{if(p.imgs.length)m['rdl:img:'+p.id]=JSON.stringify(p.imgs)});D.banners.forEach(b=>{if(b.img)m['rdl:ban:'+b.id]=b.img});return m};
const slim=()=>({...D,products:D.products.map(({imgs,...p})=>({...p,hasImg:imgs.length>0})),banners:D.banners.map(({img,...b})=>({...b,hasImg:!!img}))});
async function persist(){if(!UU)return;if(busy){again=true;return}busy=true;
 try{do{again=false;const m=blobs();
  for(const k in m){if(saved[k]!==m[k]){await rc(['SET',k,m[k]]);saved[k]=m[k]}}
  for(const k of Object.keys(saved))if(!(k in m)){await rc(['DEL',k]);delete saved[k]}
  await rc(['SET','rdl:meta',JSON.stringify(slim())]);dbState={ok:true,msg:'সেভ হচ্ছে',at:new Date().toISOString()};
 }while(again)}catch(e){dbState={ok:false,msg:String(e.message).slice(0,200)};console.log('persist fail',e.message)}busy=false}
const save=()=>{try{fs.writeFileSync(DB,JSON.stringify(D))}catch(e){}clearTimeout(tm);tm=setTimeout(persist,300)};
setInterval(()=>{if(dirty){dirty=false;save()}},60000);
async function boot(){
 console.log('Upstash env → URL:',UU?'আছে':'নেই','| TOKEN:',UT?'আছে':'নেই');
 if(UU){try{const m=await rc(['GET','rdl:meta']);
  if(m){const R=JSON.parse(m);
   for(const p of R.products){const v=p.hasImg?await rc(['GET','rdl:img:'+p.id]):null;if(v){p.imgs=v.startsWith('[')?JSON.parse(v):[v];saved['rdl:img:'+p.id]=v}else p.imgs=p.imgs||[];delete p.hasImg}
   for(const b of R.banners||[]){if(b.hasImg){b.img=await rc(['GET','rdl:ban:'+b.id])||'';saved['rdl:ban:'+b.id]=b.img}delete b.hasImg}
   D={...R,orders:R.orders||[],users:R.users||{},sessions:R.sessions||{},coupons:R.coupons||[],tickets:R.tickets||[],settings:R.settings||{},banners:R.banners||[]};migrate();dbState={ok:true,msg:'সংযুক্ত',at:new Date().toISOString()};console.log('Upstash থেকে ডেটা লোড হয়েছে')}
  else await persist();
 }catch(e){console.log('Upstash লোড ব্যর্থ, বন্ধ করা হচ্ছে (ডেটা বাঁচাতে):',e.message);process.exit(1)}}
 srv.listen(PORT,()=>console.log('RDL SHOP → http://localhost:'+PORT+'  | অ্যাডমিন → /admin'))}
const bk=(p,o={})=>fetch(E.BK_BASE+p,{...o,headers:{'Content-Type':'application/json',[E.BK_AUTH_HEADER||'Authorization']:(E.BK_AUTH_PREFIX??'Bearer ')+E.BK_KEY}});
const types={'.html':'text/html;charset=utf-8','.css':'text/css','.js':'text/javascript'};
const DEF_BNOTE=`১. বিকাশ অ্যাপে Send Money চাপুন।
২. উপরের নম্বরটি দিন ও মোট টাকা লিখুন।
৩. রেফারেন্সে আপনার নাম লিখুন।
৪. টাকা পাঠানোর পর নিচে আপনার বিকাশ নম্বর ও TrxID দিয়ে অর্ডার কনফার্ম করুন।`,DEF_RET=`• পণ্য হাতে পাওয়ার ৭ দিনের মধ্যে ত্রুটিপূর্ণ বা ভুল পণ্য ফেরত/বদলের আবেদন করা যাবে।\n• ডেলিভারি ম্যানের সামনে পণ্য দেখে নিন, সমস্যা থাকলে সাপোর্টে জানান।\n• ব্যবহৃত বা প্যাকেজ নষ্ট পণ্য ফেরত নেওয়া হবে না।\n• ওয়ারেন্টিযুক্ত পণ্যের শর্ত পণ্যের বিবরণে উল্লেখ থাকবে।`,DEF_TERMS=`• অর্ডার করলে আমাদের প্রতিনিধি কনফার্ম করতে ফোন করবেন।\n• পণ্যের দাম ও স্টক যেকোনো সময় পরিবর্তন হতে পারে।\n• ডেলিভারি সাধারণত ২৪-৭২ ঘণ্টায় হয়।\n• ভুল তথ্য দিলে অর্ডার বাতিল হতে পারে।`;
const tg=m=>{if(E.TG_TOKEN&&E.TG_CHAT)fetch('https://api.telegram.org/bot'+E.TG_TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:E.TG_CHAT,text:m})}).catch(()=>{})};
const rsStats=em=>{let earned=0,pend=0;D.orders.forEach(o=>{if(o.rs&&o.email===em){if(o.status==='ডেলিভারড')earned+=o.rs.profit;else if(o.status!=='বাতিল')pend+=o.rs.profit}});
 const ps=D.payouts.filter(p=>p.email===em),paid=ps.filter(p=>p.status==='paid').reduce((a,p)=>a+p.amount,0),req=ps.filter(p=>p.status==='pending').reduce((a,p)=>a+p.amount,0);return{earned,pend,paid,req,avail:earned-paid-req}};
const RSLIST=()=>Object.values(D.users).filter(u=>u.rs).map(u=>({email:u.email,name:u.name,...u.rs,...rsStats(u.email)}));
const advPct=()=>{const v=D.settings.adv;return v===undefined||v===''?50:Math.max(0,Math.min(100,+v||0))};
const pub=p=>{const rv=p.reviews||[],n=rv.length,avg=n?Math.round(rv.reduce((a,r)=>a+r.rating,0)/n*10)/10:0;
 return{id:p.id,name:p.name,cat:p.cat,price:p.price,old:p.old,stock:p.stock,em:p.em,imgs:p.imgs.map((u,i)=>u.startsWith('data:')?'/img/'+p.id+'/'+i+'?v='+(p.iv||1):u),video:p.video,desc:p.desc,type:p.type,featured:p.featured,sold:p.sold||0,rating:avg,rc:n,reviews:rv.slice(0,15).map(({email,...r})=>r),score:(p.sold||0)*5+(p.carts||0)*2+(p.views||0)*.2+(p.featured?50:0)}};
const delivery=(s,z)=>s>=3000?0:(z==='out'?120:60);
function disc(code,sub){const c=D.coupons.find(x=>x.active&&x.code.toUpperCase()===String(code||'').toUpperCase());
 if(!c)return{error:'কুপন কোডটি সঠিক নয়'};if(sub<c.min)return{error:'এই কুপনের জন্য সর্বনিম্ন ৳'+c.min+' কেনাকাটা করতে হবে'};
 return{code:c.code,discount:Math.min(sub,Math.round(c.type==='pct'?sub*c.val/100:c.val))}}
const fails={};
const srv=http.createServer(async(req,res)=>{
 const p=new URL(req.url,'http://x').pathname;
 const send=(c,b)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(b))};
 const body=()=>new Promise(r=>{let s='';req.on('data',c=>{s+=c;if(s.length>8e6){req.destroy()}});req.on('end',()=>{try{r(JSON.parse(s||'{}'))}catch(e){r({})}})});
 const tok=(req.headers.authorization||'').replace('Bearer ','');
 const email=D.sessions[tok],user=email&&D.users[email];
 const clean=(x,ex)=>{const src=Array.isArray(x.imgs)?x.imgs:(x.img?[x.img]:[]);
  const imgs=src.slice(0,5).map(u=>{u=String(u||'');const m=u.match(/^\/img\/(\d+)\/(\d+)/);if(m){const q=D.products.find(y=>y.id===+m[1]);return q&&q.imgs[+m[2]]||''}return/^(data:image\/|https:\/\/)/.test(u)?u:''}).filter(Boolean);
  const vd=String(x.video||'').trim();
  return{name:String(x.name||'').slice(0,150),cat:String(x.cat||'অন্যান্য').slice(0,40),price:Math.max(0,+x.price||0),old:Math.max(0,+x.old||+x.price||0),stock:Math.max(0,parseInt(x.stock)||0),em:String(x.em||'📦').slice(0,4),imgs,video:/^https:\/\//.test(vd)?vd.slice(0,300):'',desc:String(x.desc||'').slice(0,2000),type:x.type==='mystery'?'mystery':'normal',featured:!!x.featured,cost:Math.max(0,+x.cost||0),rp:Math.max(0,+x.rp||0)}};
 try{
  const im=p.match(/^\/img\/(\d+)\/(\d+)$/),bm=p.match(/^\/ban\/(\d+)$/);
  if(im||bm){const u=im?(D.products.find(x=>x.id===+im[1])||{imgs:[]}).imgs[+im[2]]:(D.banners.find(x=>x.id===+bm[1])||{}).img;const m=u&&u.match(/^data:(image\/[\w+.-]+);base64,([\s\S]+)$/);
   if(!m){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':m[1],'Cache-Control':'public,max-age=604800'});return res.end(Buffer.from(m[2],'base64'))}
  const sh=p.match(/^\/p\/(\d+)$/);
  if(sh){const q=D.products.find(x=>x.id===+sh[1]);if(!q){res.writeHead(302,{Location:'/'});return res.end()}
   const base=E.SITE_URL||('https://'+req.headers.host),e2=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
   const i0=q.imgs[0]?(q.imgs[0].startsWith('data:')?base+'/img/'+q.id+'/0?v='+(q.iv||1):q.imgs[0]):'';
   res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
   return res.end(`<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8"><title>${e2(q.name)} | RDL SHOP</title><meta property="og:type" content="product"><meta property="og:title" content="${e2(q.name)} — ৳${q.price}"><meta property="og:description" content="${e2((q.desc||'').slice(0,150)||'RDL SHOP-এ কিনুন, ক্যাশ অন ডেলিভারি')}"><meta property="og:image" content="${e2(i0)}"><meta property="og:url" content="${e2(base)}/p/${q.id}"><meta name="twitter:card" content="summary_large_image"><meta http-equiv="refresh" content="0;url=/#p${q.id}"></head><body><script>location.replace("/#p${q.id}")</script></body></html>`)}
  if(p.startsWith('/api/')){
   if(p==='/api/config'){const t=D.settings;return send(200,{gid:GID,phone:t.phone||E.SUPPORT_PHONE||'',wa:t.wa||'',email:t.email||E.SUPPORT_EMAIL||'',hours:t.hours||E.SUPPORT_HOURS||'',ret:t.ret||DEF_RET,terms:t.terms||DEF_TERMS,rsMin:+t.rsMin||500,bkash:t.bkash||'',adv:t.bkash?advPct():0,bnote:t.bnote||DEF_BNOTE,c2:+t.c2||5,c3:+t.c3||10,banners:D.banners.map(b=>({id:b.id,link:b.link,src:'/ban/'+b.id}))})}
   if(p==='/api/products'&&req.method==='GET')return send(200,D.products.map(pub));
   if(p==='/api/auth/google'&&req.method==='POST'){
    if(!GID)return send(400,{error:'GOOGLE_CLIENT_ID সেট করা নেই'});
    const b=await body();const r=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(b.credential||''));
    const j=await r.json();
    if(!r.ok||j.aud!==GID||j.email_verified!=='true'||!/@gmail\.com$/i.test(j.email||''))return send(401,{error:'শুধু বৈধ Gmail অ্যাকাউন্ট দিয়ে লগইন করা যাবে'});
    const em=j.email.toLowerCase();const u=D.users[em]=D.users[em]||{email:em,phone:'',addr:'',wish:[],at:new Date().toISOString()};
    u.name=j.name||u.name;u.picture=j.picture||'';const t=crypto.randomBytes(24).toString('hex');D.sessions[t]=em;save();
    return send(200,{token:t,user:u,orders:D.orders.filter(o=>o.email===em&&!o.rs)});
   }
   if(p==='/api/hit'&&req.method==='POST'){const b=await body(),q=D.products.find(x=>x.id===+b.id);if(q){if(b.t==='c')q.carts=(q.carts||0)+1;else q.views=(q.views||0)+1;dirty=true}return send(200,{})}
   if(p==='/api/track'&&req.method==='POST'){const b=await body(),ph=String(b.phone||'').replace(/\D/g,'').replace(/^88/,'');const o=D.orders.find(x=>x.id===+b.id&&x.phone===ph);
    if(!o)return send(404,{error:'অর্ডার পাওয়া যায়নি, নম্বর ও ফোন মিলিয়ে দেখুন'});return send(200,{id:o.id,status:o.status,total:o.total,at:o.at,items:o.items.map(i=>({name:i.name,n:i.n}))})}
   if(p==='/api/coupon'&&req.method==='POST'){const b=await body();const d=disc(b.code,+b.subtotal||0);return send(d.error?400:200,d)}
   if(p==='/api/me'||p==='/api/wish'||p==='/api/orders'||p==='/api/orders/cancel'||p==='/api/tickets'||p==='/api/reviews'){
    if(!user)return send(401,{error:'আগে লগইন করুন'});
    if(p==='/api/me'&&req.method==='GET')return send(200,{user,orders:D.orders.filter(o=>o.email===email&&!o.rs)});
    if(p==='/api/me'&&req.method==='PUT'){const b=await body();user.name=String(b.name||user.name).slice(0,80);user.phone=String(b.phone||'').slice(0,11);user.addr=String(b.addr||'').slice(0,300);save();return send(200,{user})}
    if(p==='/api/tickets'&&req.method==='GET')return send(200,D.tickets.filter(t=>t.email===email));
    if(p==='/api/tickets'&&req.method==='POST'){const b=await body(),m=String(b.msg||'').trim().slice(0,1000);if(!m)return send(400,{error:'মেসেজ লিখুন'});
     const t={id:(D.tickets[0]?.id||100)+1,email,name:user.name,phone:user.phone,orderId:+b.orderId||0,msg:m,reply:'',rs:!!(user.rs&&user.rs.status==='approved'),status:'open',at:new Date().toISOString()};D.tickets.unshift(t);save();
     tg('🆘 নতুন সাপোর্ট #'+t.id+'\n'+(user.name||email)+' · '+(user.phone||'')+(t.orderId?'\nঅর্ডার #'+t.orderId:'')+'\n'+m);return send(200,{ok:true})}
    if(p==='/api/reviews'&&req.method==='POST'){const b=await body(),q=D.products.find(x=>x.id===+b.pid);const ok=D.orders.some(o=>o.email===email&&!o.rs&&o.status==='ডেলিভারড'&&o.items.some(i=>i.id===+b.pid));
     if(!q||!ok)return send(400,{error:'ডেলিভারি পাওয়া পণ্যেরই রিভিউ দেওয়া যায়'});if(q.reviews.some(r=>r.email===email))return send(400,{error:'আপনি আগেই রিভিউ দিয়েছেন'});
     q.reviews.unshift({id:Date.now(),email,name:(user.name||'ক্রেতা').split(' ')[0],rating:Math.max(1,Math.min(5,Math.round(+b.rating||5))),text:String(b.text||'').slice(0,500),at:new Date().toISOString(),ver:true});save();return send(200,{ok:true})}
    if(p==='/api/wish'){const b=await body();const i=user.wish.indexOf(b.id);i>-1?user.wish.splice(i,1):user.wish.push(b.id);save();return send(200,{wish:user.wish})}
    if(p==='/api/orders/cancel'){const b=await body();const o=D.orders.find(x=>x.id===b.id&&x.email===email);
     if(!o||!['পেন্ডিং','পেমেন্ট যাচাই বাকি'].includes(o.status))return send(400,{error:'এই অর্ডার বাতিল করা যাবে না'});
     o.status='বাতিল';o.items.forEach(i=>{const x=D.products.find(y=>y.id===i.id);if(x){x.stock+=i.n;x.sold=Math.max(0,(x.sold||0)-i.n)}});save();return send(200,{ok:true})}
    if(p==='/api/orders'&&req.method==='POST'){
     const b=await body();
     if(!b.name||!/^01\d{9}$/.test(b.phone||'')||!b.addr||!b.district||!Array.isArray(b.items)||!b.items.length)return send(400,{error:'নাম, সঠিক মোবাইল ও ঠিকানা দিন'});
     let sub=0;const items=[];
     for(const i of b.items){const x=D.products.find(y=>y.id===i.id);if(!x||!(i.n>0))continue;
      if(x.stock<i.n)return send(400,{error:'স্টকে নেই: '+x.name});items.push({id:x.id,name:x.name,n:Math.floor(i.n),price:x.price});sub+=x.price*Math.floor(i.n)}
     if(!items.length)return send(400,{error:'কার্ট খালি'});
     const st2=D.settings,pc=items.length>=3?(+st2.c3||10):items.length>=2?(+st2.c2||5):0,cd=b.combo&&items.length>=2?Math.round(sub*pc/100):0;
     let d=0,code='';if(b.coupon){const c=disc(b.coupon,sub-cd);if(!c.error){d=c.discount;code=c.code}}
     const trx=String(b.trx||'').trim().slice(0,20),sp=String(b.sender||'').replace(/\D/g,'').slice(-11);
     
     const zn=String(b.district||'').toLowerCase()==='dhaka'?'dhaka':'out',dl=delivery(sub,zn);
     const total0=sub-cd-d+dl,advReq=D.settings.bkash?Math.round(dl*advPct()/100):0;let mode=b.mode==='full'?'full':b.mode==='adv'?'adv':'cod';if(mode==='adv'&&!advReq)mode='cod';
     if(mode!=='cod'&&!D.settings.bkash)return send(400,{error:'বিকাশ পেমেন্ট এখনো চালু হয়নি'});
     if(mode==='cod'&&advReq>0)return send(400,{error:'অর্ডার কনফার্ম করতে অগ্রিম ৳'+advReq+' বিকাশে পাঠাতে হবে'});
     const pay=mode==='cod'?'cod':'bkash',adv=mode==='full'?total0:mode==='adv'?advReq:0;
     if(pay==='bkash'&&(!/^[A-Za-z0-9]{6,20}$/.test(trx)||!/^01\d{9}$/.test(sp)))return send(400,{error:'বিকাশ TrxID ও যে নম্বর থেকে পাঠিয়েছেন সেটি সঠিকভাবে দিন'});
     items.forEach(i=>{const x=D.products.find(y=>y.id===i.id);x.stock-=i.n;x.sold=(x.sold||0)+i.n});
     const o={id:(D.orders[0]?.id||1000)+1,email,name:String(b.name).slice(0,80),phone:b.phone,addr:String(b.addr).slice(0,300),zone:zn,division:String(b.division||'').slice(0,40),district:String(b.district||'').slice(0,40),thana:String(b.thana||'').slice(0,60),items,sub,discount:d,coupon:code,combo:cd,pay,adv,trx,sender:sp,paid:false,delivery:dl,total:sub-cd-d+dl,status:adv>0?'পেমেন্ট যাচাই বাকি':'পেন্ডিং',at:new Date().toISOString()};
     D.orders.unshift(o);user.phone=user.phone||o.phone;user.addr=user.addr||o.addr;save();
     if(E.BK_BASE&&E.BK_ORDERS_PATH)bk(E.BK_ORDERS_PATH,{method:'POST',body:JSON.stringify(o)}).catch(e=>console.log('BK order fail',e.message)); // Business Koro-র ফরম্যাট অনুযায়ী বদলে নিন
     if(E.TG_TOKEN&&E.TG_CHAT){const m='🛒 নতুন অর্ডার #'+o.id+'\n'+o.name+' · '+o.phone+'\n'+o.district+', '+o.thana+', '+o.addr+'\n'+o.items.map(i=>i.name+' ×'+i.n).join(', ')+'\nমোট: ৳'+o.total+' '+(o.pay==='bkash'?'(অগ্রিম ৳'+o.adv+' বিকাশে, TrxID: '+o.trx+' — যাচাই করে কনফার্ম করুন)':'(ক্যাশ অন ডেলিভারি)');
      fetch('https://api.telegram.org/bot'+E.TG_TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:E.TG_CHAT,text:m})}).catch(e=>console.log('TG fail',e.message))}
     return send(200,{ok:true,id:o.id,total:o.total,pay:o.pay,adv:o.adv});
    }
   }
   if(p.startsWith('/api/rs/')){
    if(!user)return send(401,{error:'আগে লগইন করুন'});const ru=user.rs;
    if(p==='/api/rs/me'&&req.method==='GET')return send(200,{rs:ru||null,stats:rsStats(email),min:+D.settings.rsMin||500,orders:D.orders.filter(o=>o.rs&&o.email===email).map(({id,name,items,total,status,rs,at})=>({id,name,items,total,status,rs:{profit:rs.profit},at})),payouts:D.payouts.filter(x=>x.email===email)});
    if(p==='/api/rs/apply'&&req.method==='POST'){const b=await body(),shop=String(b.shop||'').trim().slice(0,60),ph=String(b.phone||'').replace(/\D/g,''),bk2=String(b.bkash||'').replace(/\D/g,'');
     if(ru)return send(400,{error:'আপনি আগেই আবেদন করেছেন'});if(shop.length<2||!/^01\d{9}$/.test(ph)||!/^01\d{9}$/.test(bk2))return send(400,{error:'দোকানের নাম, সঠিক মোবাইল ও বিকাশ নম্বর দিন'});
     user.rs={status:'pending',shop,phone:ph,bkash:bk2,at:new Date().toISOString()};save();tg('💼 নতুন রিসেলার আবেদন\n'+shop+' · '+ph+'\n'+email);return send(200,{ok:true})}
    if(!ru||ru.status!=='approved')return send(403,{error:'রিসেলার অ্যাকাউন্ট অনুমোদিত নয়'});
    if(p==='/api/rs/products')return send(200,D.products.filter(x=>x.rp>0).map(x=>({id:x.id,rp:x.rp})));
    if(p==='/api/rs/orders'&&req.method==='POST'){const b=await body();
     if(!b.name||!/^01\d{9}$/.test(String(b.phone||''))||!b.addr||!b.district||!Array.isArray(b.items)||!b.items.length)return send(400,{error:'ক্রেতার নাম, সঠিক মোবাইল, জেলা ও ঠিকানা দিন'});
     let sub=0,profit=0,cost=0;const items=[];
     for(const i of b.items){const x=D.products.find(y=>y.id===i.id),n=Math.floor(+i.n),pr=Math.round(+i.price);if(!x||!(n>0)||!(x.rp>0))continue;
      if(!(pr>=x.rp))return send(400,{error:x.name+': বিক্রয়মূল্য আপনার দামের (৳'+x.rp+') নিচে হতে পারে না'});if(x.stock<n)return send(400,{error:'স্টকে নেই: '+x.name});
      items.push({id:x.id,name:x.name,n,price:pr,rprice:x.rp});sub+=pr*n;profit+=(pr-x.rp)*n;cost+=x.rp*n}
     if(!items.length)return send(400,{error:'অর্ডারে পণ্য নেই'});
     const zn=String(b.district).toLowerCase()==='dhaka'?'dhaka':'out',dl=zn==='out'?120:60;
     items.forEach(i=>{const x=D.products.find(y=>y.id===i.id);x.stock-=i.n;x.sold=(x.sold||0)+i.n});
     const o={id:(D.orders[0]?.id||1000)+1,email,name:String(b.name).slice(0,80),phone:b.phone,addr:String(b.addr).slice(0,300),zone:zn,division:String(b.division||'').slice(0,40),district:String(b.district).slice(0,40),thana:String(b.thana||'').slice(0,60),items,sub,discount:0,coupon:'',combo:0,delivery:dl,total:sub+dl,pay:'cod',adv:0,paid:false,note:String(b.note||'').slice(0,200),status:'পেন্ডিং',at:new Date().toISOString(),rs:{profit,cost,shop:ru.shop}};
     D.orders.unshift(o);save();tg('💼 রিসেলার অর্ডার #'+o.id+' ('+ru.shop+')\n'+o.name+' · '+o.phone+'\n'+o.district+', '+o.thana+', '+o.addr+'\n'+items.map(i=>i.name+' ×'+i.n).join(', ')+'\nCOD মোট: ৳'+o.total+' | রিসেলার লাভ: ৳'+profit);
     return send(200,{ok:true,id:o.id,total:o.total,profit})}
    if(p==='/api/rs/payout'&&req.method==='POST'){const b=await body(),stt=rsStats(email),min=+D.settings.rsMin||500,amt=Math.floor(+b.amount),bk2=String(b.bkash||ru.bkash).replace(/\D/g,'');
     if(!(amt>=min))return send(400,{error:'সর্বনিম্ন ৳'+min+' তুলতে হবে'});if(amt>stt.avail)return send(400,{error:'তোলার মতো জমা লাভ ৳'+stt.avail});if(!/^01\d{9}$/.test(bk2))return send(400,{error:'সঠিক বিকাশ নম্বর দিন'});
     D.payouts.unshift({id:Date.now(),email,name:ru.shop,amount:amt,bkash:bk2,status:'pending',at:new Date().toISOString()});save();tg('💸 টাকা তোলার অনুরোধ\n'+ru.shop+' · ৳'+amt+'\nবিকাশ: '+bk2);return send(200,{ok:true})}
    return send(404,{error:'not found'})}
   if(p.startsWith('/api/admin/')){
    const ip=req.socket.remoteAddress,f=fails[ip]||{n:0,t:Date.now()};if(Date.now()-f.t>6e5){f.n=0;f.t=Date.now()}
    if(f.n>=10)return send(429,{error:'অনেকবার ভুল, ১০ মিনিট পর চেষ্টা করুন'});
    const a=Buffer.from(String(req.headers['x-admin']||'')),b2=Buffer.from(PASS);
    if(a.length!==b2.length||!crypto.timingSafeEqual(a,b2)){f.n++;fails[ip]=f;return send(401,{error:'unauthorized'})}
    if(p==='/api/admin/data')return send(200,{products:D.products.map(p=>({...pub(p),cost:p.cost,rp:p.rp,views:p.views,carts:p.carts})),banners:D.banners.map(b=>({id:b.id,link:b.link})),orders:D.orders,coupons:D.coupons,tickets:D.tickets,settings:D.settings,db:dbState,resellers:RSLIST(),payouts:D.payouts,users:Object.values(D.users).map(u=>({...u}))});
    if(p==='/api/admin/product'&&req.method==='POST'){const b=await body(),ex=D.products.find(x=>x.id===b.id),c=clean(b,ex);if(!c.name||!c.price)return send(400,{error:'নাম ও দাম দিন'});c.iv=Date.now();
     if(ex)Object.assign(ex,c);else D.products.push(norm({id:Math.max(0,...D.products.map(x=>x.id))+1,...c}));save();return send(200,{ok:true})}
    if(p==='/api/admin/product'&&req.method==='DELETE'){const b=await body();D.products=D.products.filter(x=>x.id!==b.id);save();return send(200,{ok:true})}
    if(p==='/api/admin/order'&&req.method==='POST'){const b=await body(),o=D.orders.find(x=>x.id===b.id);if(o){if(b.paid!==undefined){o.paid=!!b.paid;if(b.paid===true&&o.status==='পেমেন্ট যাচাই বাকি')o.status='পেন্ডিং'}
     if(b.status&&['পেমেন্ট যাচাই বাকি','পেন্ডিং','প্রসেসিং','শিপড','ডেলিভারড','বাতিল'].includes(b.status)){if(b.status==='বাতিল'&&o.status!=='বাতিল')o.items.forEach(i=>{const x=D.products.find(y=>y.id===i.id);if(x){x.stock+=i.n;x.sold=Math.max(0,(x.sold||0)-i.n)}});o.status=b.status}save()}return send(200,{ok:true})}
    if(p==='/api/admin/backup')return send(200,{products:D.products});
    if(p==='/api/admin/banner'&&req.method==='POST'){const b=await body();if(/^data:image\//.test(b.img||'')&&D.banners.length<8){D.banners.push({id:Date.now(),img:b.img,link:String(b.link||'').slice(0,300)});save()}return send(200,{ok:true})}
    if(p==='/api/admin/banner'&&req.method==='DELETE'){const b=await body();D.banners=D.banners.filter(x=>x.id!==b.id);save();return send(200,{ok:true})}
    if(p==='/api/admin/review'&&req.method==='POST'){const b=await body(),q=D.products.find(x=>x.id===+b.pid);if(!q||!String(b.text||'').trim())return send(400,{error:'পণ্য ও রিভিউ লিখুন'});
     q.reviews.unshift({id:Date.now(),name:String(b.name||'ক্রেতা').slice(0,40),rating:Math.max(1,Math.min(5,Math.round(+b.rating||5))),text:String(b.text).slice(0,500),at:new Date().toISOString(),ver:false});save();return send(200,{ok:true})}
    if(p==='/api/admin/review'&&req.method==='DELETE'){const b=await body(),q=D.products.find(x=>x.id===+b.pid);if(q){q.reviews=q.reviews.filter(r=>r.id!==b.rid);save()}return send(200,{ok:true})}
    if(p==='/api/admin/reseller'&&req.method==='POST'){const b=await body(),u2=D.users[String(b.email||'').toLowerCase()];if(u2&&u2.rs&&['approved','blocked','pending'].includes(b.status)){u2.rs.status=b.status;save()}return send(200,{ok:true})}
    if(p==='/api/admin/payout'&&req.method==='POST'){const b=await body(),q=D.payouts.find(x=>x.id===b.id);if(q&&q.status==='pending'&&['paid','rejected'].includes(b.status)){q.status=b.status;q.at2=new Date().toISOString();save()}return send(200,{ok:true})}
    if(p==='/api/admin/dbtest'&&req.method==='POST'){if(UU)await persist();return send(200,dbState)}
    if(p==='/api/admin/settings'&&req.method==='PUT'){const b=await body();D.settings={};for(const k of['phone','wa','email','hours','ret','terms','bkash','bnote','c2','c3','adv','rsMin'])D.settings[k]=String(b[k]||'').slice(0,5000);save();return send(200,{ok:true})}
    if(p==='/api/admin/ticket'&&req.method==='POST'){const b=await body(),t=D.tickets.find(x=>x.id===b.id);if(t){t.reply=String(b.reply||'').slice(0,1000);t.status=b.status==='closed'?'closed':'open';save()}return send(200,{ok:true})}
    if(p==='/api/admin/restore'&&req.method==='POST'){const b=await body();const a=Array.isArray(b.products)?b.products:[];let id=Math.max(0,...D.products.map(x=>x.id)),n=0;
     for(const x of a){const c=clean(x);if(!c.name||!c.price)continue;const ex=D.products.find(y=>y.name===c.name);if(ex)Object.assign(ex,c);else D.products.push(norm({id:++id,...c}));n++}
     save();return send(200,{count:n})}
    if(p==='/api/admin/coupons'&&req.method==='PUT'){const b=await body();D.coupons=(b.coupons||[]).map(c=>({code:String(c.code).toUpperCase().slice(0,20),type:c.type==='flat'?'flat':'pct',val:+c.val||0,min:+c.min||0,active:!!c.active})).filter(c=>c.code);save();return send(200,{ok:true})}
    if(p==='/api/admin/sync'&&req.method==='POST'){
     if(!E.BK_BASE)return send(400,{error:'BK_BASE সেট করা নেই'});
     const r=await bk(E.BK_PRODUCTS_PATH||'/products');if(!r.ok)return send(502,{error:'HTTP '+r.status});
     const j=await r.json(),arr=Array.isArray(j)?j:(j.data||j.products||j.items||[]);let id=Math.max(0,...D.products.map(x=>x.id));
     for(const x of arr){const name=x.name||x.title;if(!name)continue;const ext=String(x.id??name),pr=+(x.price||x.sale_price||0);
      const o={name,price:pr,old:+(x.old_price||x.regular_price||pr),cat:x.category||'অন্যান্য',stock:+(x.stock??x.quantity??0),em:'📦',ext};
      const ex=D.products.find(y=>y.ext===ext);if(ex)Object.assign(ex,o);else D.products.push(norm({id:++id,desc:'',...o}))}
     save();return send(200,{count:arr.length});
    }
   }
   return send(404,{error:'not found'});
  }
  const pages={'/':'rdl-shop.html','/admin':'rdl-admin.html'};
  const fp=pages[p]&&path.join(__dirname,pages[p]);
  if(!fp||!fs.existsSync(fp))return send(404,{error:'not found'});
  res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end(fs.readFileSync(fp));
 }catch(e){send(500,{error:e.message})}
});
boot();
