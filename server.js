// RDL SHOP — Node 18+, কোনো প্যাকেজ লাগে না: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const E=process.env,PORT=E.PORT||3000,PASS=E.ADMIN_PASS||'RDL555',DB=E.DB_FILE||'data.json',GID=E.GOOGLE_CLIENT_ID||'';
const seed=[["ওয়্যারলেস ব্লুটুথ হেডফোন","ইলেকট্রনিক্স",1450,2200,25,"🎧",4.5,320],["স্মার্ট ওয়াচ","ইলেকট্রনিক্স",2490,3500,12,"⌚",4.3,210],["পুরুষদের কটন পাঞ্জাবি","ফ্যাশন",1190,1600,40,"👕",4.6,540],["মহিলাদের হ্যান্ডব্যাগ","ফ্যাশন",990,1500,18,"👜",4.4,180],["নন-স্টিক ফ্রাইং প্যান","হোম ও কিচেন",650,900,30,"🍳",4.7,760],["স্পোর্টস রানিং শুজ","ফ্যাশন",1850,2600,15,"👟",4.5,290],["পাওয়ার ব্যাংক ২০০০০mAh","ইলেকট্রনিক্স",1590,2000,50,"🔋",4.6,910],["ফেস ওয়াশ সেট","বিউটি",520,750,60,"🧴",4.2,430]].map((a,i)=>({id:i+1,name:a[0],cat:a[1],price:a[2],old:a[3],stock:a[4],em:a[5],img:'',desc:'আসল ও মানসম্মত পণ্য। ক্যাশ অন ডেলিভারি ও ৭ দিনের রিটার্ন সুবিধা।',rating:a[6],sold:a[7]}));
let D=fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB)):{};
D.products=D.products||seed;D.orders=D.orders||[];D.users=D.users||{};D.sessions=D.sessions||{};
D.coupons=D.coupons||[{code:'RDL10',type:'pct',val:10,min:500,active:true}];
const save=()=>fs.writeFileSync(DB,JSON.stringify(D));
const bk=(p,o={})=>fetch(E.BK_BASE+p,{...o,headers:{'Content-Type':'application/json',[E.BK_AUTH_HEADER||'Authorization']:(E.BK_AUTH_PREFIX??'Bearer ')+E.BK_KEY}});
const types={'.html':'text/html;charset=utf-8','.css':'text/css','.js':'text/javascript'};
const delivery=(s,z)=>s>=3000?0:(z==='out'?120:60);
function disc(code,sub){const c=D.coupons.find(x=>x.active&&x.code.toUpperCase()===String(code||'').toUpperCase());
 if(!c)return{error:'কুপন কোডটি সঠিক নয়'};if(sub<c.min)return{error:'এই কুপনের জন্য সর্বনিম্ন ৳'+c.min+' কেনাকাটা করতে হবে'};
 return{code:c.code,discount:Math.min(sub,Math.round(c.type==='pct'?sub*c.val/100:c.val))}}
const fails={};
http.createServer(async(req,res)=>{
 const p=new URL(req.url,'http://x').pathname;
 const send=(c,b)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(b))};
 const body=()=>new Promise(r=>{let s='';req.on('data',c=>{s+=c;if(s.length>8e6){req.destroy()}});req.on('end',()=>{try{r(JSON.parse(s||'{}'))}catch(e){r({})}})});
 const tok=(req.headers.authorization||'').replace('Bearer ','');
 const email=D.sessions[tok],user=email&&D.users[email];
 const clean=x=>{const img=String(x.img||'');return{name:String(x.name||'').slice(0,150),cat:String(x.cat||'অন্যান্য').slice(0,40),price:Math.max(0,+x.price||0),old:Math.max(0,+x.old||+x.price||0),stock:Math.max(0,parseInt(x.stock)||0),em:String(x.em||'📦').slice(0,4),img:/^(data:image\/|https:\/\/)/.test(img)?img:'',desc:String(x.desc||'').slice(0,2000)}};
 try{
  if(p.startsWith('/api/')){
   if(p==='/api/config')return send(200,{gid:GID});
   if(p==='/api/products'&&req.method==='GET')return send(200,D.products);
   if(p==='/api/auth/google'&&req.method==='POST'){
    if(!GID)return send(400,{error:'GOOGLE_CLIENT_ID সেট করা নেই'});
    const b=await body();const r=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(b.credential||''));
    const j=await r.json();
    if(!r.ok||j.aud!==GID||j.email_verified!=='true'||!/@gmail\.com$/i.test(j.email||''))return send(401,{error:'শুধু বৈধ Gmail অ্যাকাউন্ট দিয়ে লগইন করা যাবে'});
    const em=j.email.toLowerCase();const u=D.users[em]=D.users[em]||{email:em,phone:'',addr:'',wish:[],at:new Date().toISOString()};
    u.name=j.name||u.name;u.picture=j.picture||'';const t=crypto.randomBytes(24).toString('hex');D.sessions[t]=em;save();
    return send(200,{token:t,user:u,orders:D.orders.filter(o=>o.email===em)});
   }
   if(p==='/api/coupon'&&req.method==='POST'){const b=await body();const d=disc(b.code,+b.subtotal||0);return send(d.error?400:200,d)}
   if(p==='/api/me'||p==='/api/wish'||p==='/api/orders'||p==='/api/orders/cancel'){
    if(!user)return send(401,{error:'আগে লগইন করুন'});
    if(p==='/api/me'&&req.method==='GET')return send(200,{user,orders:D.orders.filter(o=>o.email===email)});
    if(p==='/api/me'&&req.method==='PUT'){const b=await body();user.name=String(b.name||user.name).slice(0,80);user.phone=String(b.phone||'').slice(0,11);user.addr=String(b.addr||'').slice(0,300);save();return send(200,{user})}
    if(p==='/api/wish'){const b=await body();const i=user.wish.indexOf(b.id);i>-1?user.wish.splice(i,1):user.wish.push(b.id);save();return send(200,{wish:user.wish})}
    if(p==='/api/orders/cancel'){const b=await body();const o=D.orders.find(x=>x.id===b.id&&x.email===email);
     if(!o||o.status!=='পেন্ডিং')return send(400,{error:'এই অর্ডার বাতিল করা যাবে না'});
     o.status='বাতিল';o.items.forEach(i=>{const x=D.products.find(y=>y.id===i.id);if(x)x.stock+=i.n});save();return send(200,{ok:true})}
    if(p==='/api/orders'&&req.method==='POST'){
     const b=await body();
     if(!b.name||!/^01\d{9}$/.test(b.phone||'')||!b.addr||!Array.isArray(b.items)||!b.items.length)return send(400,{error:'নাম, সঠিক মোবাইল ও ঠিকানা দিন'});
     let sub=0;const items=[];
     for(const i of b.items){const x=D.products.find(y=>y.id===i.id);if(!x||!(i.n>0))continue;
      if(x.stock<i.n)return send(400,{error:'স্টকে নেই: '+x.name});items.push({id:x.id,name:x.name,n:Math.floor(i.n),price:x.price});sub+=x.price*Math.floor(i.n)}
     if(!items.length)return send(400,{error:'কার্ট খালি'});
     let d=0,code='';if(b.coupon){const c=disc(b.coupon,sub);if(!c.error){d=c.discount;code=c.code}}
     const dl=delivery(sub,b.zone);
     items.forEach(i=>{const x=D.products.find(y=>y.id===i.id);x.stock-=i.n;x.sold=(x.sold||0)+i.n});
     const o={id:(D.orders[0]?.id||1000)+1,email,name:String(b.name).slice(0,80),phone:b.phone,addr:String(b.addr).slice(0,300),zone:b.zone==='out'?'out':'dhaka',items,sub,discount:d,coupon:code,delivery:dl,total:sub-d+dl,status:'পেন্ডিং',at:new Date().toISOString()};
     D.orders.unshift(o);user.phone=user.phone||o.phone;user.addr=user.addr||o.addr;save();
     if(E.BK_BASE&&E.BK_ORDERS_PATH)bk(E.BK_ORDERS_PATH,{method:'POST',body:JSON.stringify(o)}).catch(e=>console.log('BK order fail',e.message)); // Business Koro-র ফরম্যাট অনুযায়ী বদলে নিন
     if(E.TG_TOKEN&&E.TG_CHAT){const m='🛒 নতুন অর্ডার #'+o.id+'\n'+o.name+' · '+o.phone+'\n'+o.addr+'\n'+o.items.map(i=>i.name+' ×'+i.n).join(', ')+'\nমোট: ৳'+o.total+' (ক্যাশ অন ডেলিভারি)';
      fetch('https://api.telegram.org/bot'+E.TG_TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:E.TG_CHAT,text:m})}).catch(e=>console.log('TG fail',e.message))}
     return send(200,{ok:true,id:o.id,total:o.total});
    }
   }
   if(p.startsWith('/api/admin/')){
    const ip=req.socket.remoteAddress,f=fails[ip]||{n:0,t:Date.now()};if(Date.now()-f.t>6e5){f.n=0;f.t=Date.now()}
    if(f.n>=10)return send(429,{error:'অনেকবার ভুল, ১০ মিনিট পর চেষ্টা করুন'});
    const a=Buffer.from(String(req.headers['x-admin']||'')),b2=Buffer.from(PASS);
    if(a.length!==b2.length||!crypto.timingSafeEqual(a,b2)){f.n++;fails[ip]=f;return send(401,{error:'unauthorized'})}
    if(p==='/api/admin/data')return send(200,{products:D.products,orders:D.orders,coupons:D.coupons,users:Object.values(D.users).map(u=>({...u}))});
    if(p==='/api/admin/product'&&req.method==='POST'){const b=await body(),c=clean(b);if(!c.name||!c.price)return send(400,{error:'নাম ও দাম দিন'});
     const ex=D.products.find(x=>x.id===b.id);if(ex)Object.assign(ex,c);else D.products.push({id:Math.max(0,...D.products.map(x=>x.id))+1,rating:4.5,sold:0,...c});save();return send(200,{ok:true})}
    if(p==='/api/admin/product'&&req.method==='DELETE'){const b=await body();D.products=D.products.filter(x=>x.id!==b.id);save();return send(200,{ok:true})}
    if(p==='/api/admin/order'&&req.method==='POST'){const b=await body(),o=D.orders.find(x=>x.id===b.id);if(o&&['পেন্ডিং','প্রসেসিং','শিপড','ডেলিভারড','বাতিল'].includes(b.status)){o.status=b.status;save()}return send(200,{ok:true})}
    if(p==='/api/admin/coupons'&&req.method==='PUT'){const b=await body();D.coupons=(b.coupons||[]).map(c=>({code:String(c.code).toUpperCase().slice(0,20),type:c.type==='flat'?'flat':'pct',val:+c.val||0,min:+c.min||0,active:!!c.active})).filter(c=>c.code);save();return send(200,{ok:true})}
    if(p==='/api/admin/sync'&&req.method==='POST'){
     if(!E.BK_BASE)return send(400,{error:'BK_BASE সেট করা নেই'});
     const r=await bk(E.BK_PRODUCTS_PATH||'/products');if(!r.ok)return send(502,{error:'HTTP '+r.status});
     const j=await r.json(),arr=Array.isArray(j)?j:(j.data||j.products||j.items||[]);let id=Math.max(0,...D.products.map(x=>x.id));
     for(const x of arr){const name=x.name||x.title;if(!name)continue;const ext=String(x.id??name),pr=+(x.price||x.sale_price||0);
      const o={name,price:pr,old:+(x.old_price||x.regular_price||pr),cat:x.category||'অন্যান্য',stock:+(x.stock??x.quantity??0),em:'📦',ext};
      const ex=D.products.find(y=>y.ext===ext);if(ex)Object.assign(ex,o);else D.products.push({id:++id,img:'',desc:'',rating:4.5,sold:0,...o})}
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
}).listen(PORT,()=>console.log('RDL SHOP → http://localhost:'+PORT+'  | অ্যাডমিন → /admin'));
