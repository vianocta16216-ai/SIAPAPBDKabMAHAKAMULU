const JSON_HEADERS = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
const SESSION_SECONDS = 8 * 60 * 60;
const PBKDF2_ITERATIONS = 210000;
const corsHeaders = origin => ({
  "access-control-allow-origin": origin || "*",
  "access-control-allow-methods":"GET,POST,PUT,OPTIONS",
  "access-control-allow-headers":"content-type,authorization,if-match",
  "vary":"Origin"
});
function response(data,status=200,origin="*"){return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...corsHeaders(origin)}})}
async function digestHex(s){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function passwordHash(password,saltHex){
 const salt=Uint8Array.from(saltHex.match(/.{2}/g)||[],x=>parseInt(x,16));
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:PBKDF2_ITERATIONS,hash:"SHA-256"},key,256);
 return [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function safeEqual(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
async function body(req){try{return await req.json()}catch{return null}}
function validPassword(p){return typeof p==="string"&&p.length>=12&&p.length<=256}
async function currentUser(req,env){
 const h=req.headers.get("authorization")||"",token=h.startsWith("Bearer ")?h.slice(7):"";
 if(!token)return null;
 const hash=await digestHex(token), now=Math.floor(Date.now()/1000);
 const row=await env.DB.prepare(`SELECT u.username,u.role,u.opd_key,u.scope,u.must_change_password,s.expires_at
 FROM sessions s JOIN users u ON u.username=s.username WHERE s.token_hash=? AND s.expires_at>? AND u.active=1`).bind(hash,now).first();
 return row?{...row,tokenHash:hash}:null;
}
async function log(env,user,action,opdKey=null,details=null){
 // Audit logging must never turn an otherwise valid login into HTTP 500.
 try{
  await env.DB.prepare("INSERT INTO audit_log(username,action,opd_key,details) VALUES(?,?,?,?)")
   .bind(user.username,action,opdKey,details?JSON.stringify(details):null).run();
 }catch(e){console.error("SIAP_AUDIT_WRITE_FAILED",{message:e?.message||String(e),action});}
}
async function ensureAuthInfrastructure(env){
 // These two tables are safe to create idempotently. Existing account rows/passwords are untouched.
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)").run();
 await env.DB.prepare("CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)").run();
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, action TEXT NOT NULL, opd_key TEXT, details TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}
async function tableColumns(env,table){
 // table is selected only from static constants below; it is never user supplied.
 const r=await env.DB.prepare(`PRAGMA table_info(${table})`).all();
 return new Set((r.results||[]).map(c=>c.name));
}
const isVerifier=u=>u.role==="bpkad_verifier";
function canReadAll(u){return ["super_admin","bpkad_verifier"].includes(u.role)}
function b64url(bytes){let bin="";for(const x of bytes)bin+=String.fromCharCode(x);return btoa(bin).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}
function pemBytes(pem){const b64=pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");return Uint8Array.from(atob(b64),c=>c.charCodeAt(0))}
async function googleToken(env){
 if(!env.GOOGLE_SERVICE_ACCOUNT_EMAIL||!env.GOOGLE_PRIVATE_KEY)throw new Error("Google Drive belum dikonfigurasi: GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY belum diisi.");
 const now=Math.floor(Date.now()/1000),head=b64url(new TextEncoder().encode(JSON.stringify({alg:"RS256",typ:"JWT"}))),claim=b64url(new TextEncoder().encode(JSON.stringify({iss:env.GOOGLE_SERVICE_ACCOUNT_EMAIL,scope:"https://www.googleapis.com/auth/drive",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600}))),input=head+"."+claim;
 const key=await crypto.subtle.importKey("pkcs8",pemBytes(env.GOOGLE_PRIVATE_KEY),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(input));const assertion=input+"."+b64url(new Uint8Array(sig));
 const res=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});const j=await res.json();if(!res.ok)throw new Error("Token Google Drive gagal dibuat: "+(j.error_description||j.error||res.status));return j.access_token;
}
async function driveFolder(env,token,opdKey){
 const rootId=env.GOOGLE_DRIVE_ROOT_FOLDER_ID;if(!rootId)throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID belum diatur.");
 const name="SIAP_APBD_"+opdKey.replace(/[^a-zA-Z0-9_-]/g,"_");const q=`name='${name}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
 let r=await fetch("https://www.googleapis.com/drive/v3/files?"+new URLSearchParams({q,fields:"files(id,name)",pageSize:"10"}),{headers:{authorization:"Bearer "+token}});let j=await r.json();if(!r.ok)throw new Error("Pencarian folder Drive gagal: "+(j.error?.message||r.status));if(j.files?.length)return j.files[0].id;
 r=await fetch("https://www.googleapis.com/drive/v3/files",{method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder",parents:[rootId]})});j=await r.json();if(!r.ok)throw new Error("Pembuatan folder Drive gagal: "+(j.error?.message||r.status));return j.id;
}
async function uploadDrive(env,opdKey,file,id){
 const token=await googleToken(env),folder=await driveFolder(env,token,opdKey);const boundary="siap_apbd_"+crypto.randomUUID().replace(/-/g,"");
 const meta=JSON.stringify({name:file.name,parents:[folder],description:"SIAP APBD Mahakam Ulu; OPD="+opdKey+"; documentId="+id});
 const bytes=new Uint8Array(await file.arrayBuffer());const prefix=new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.type||"application/octet-stream"}\r\n\r\n`),suffix=new TextEncoder().encode(`\r\n--${boundary}--`);const all=new Uint8Array(prefix.length+bytes.length+suffix.length);all.set(prefix);all.set(bytes,prefix.length);all.set(suffix,prefix.length+bytes.length);
 const r=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",{method:"POST",headers:{authorization:"Bearer "+token,"content-type":"multipart/related; boundary="+boundary},body:all});const j=await r.json();if(!r.ok)throw new Error("Unggah Google Drive gagal: "+(j.error?.message||r.status));return j;
}
async function handler(req,env){
 const url=new URL(req.url),path=url.pathname,origin=req.headers.get("origin")||"*";
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders(origin)});
 if(!path.startsWith("/api/"))return env.ASSETS ? env.ASSETS.fetch(req) : response({error:"Not found"},404,origin);
 if(path==="/api/health"&&req.method==="GET"){
  if(!env?.DB)return response({ok:false,service:"SIAP APBD API",database:"missing_binding",message:"Binding D1 bernama DB belum tersedia pada environment Production."},503,origin);
  try{
   const required={
    users:["username","password_salt","password_hash","role","opd_key","scope","active","must_change_password"],
    sessions:["token_hash","username","expires_at","created_at"],
    audit_log:["username","action","opd_key","details","created_at"],
    opd_data:["opd_key","payload","version","updated_by","updated_at"],
    documents:["id","opd_key","filename","content_type","size_bytes","r2_key","drive_file_id","drive_web_view_link","uploaded_by","created_at"]
   };
   const tables={},issues=[];
   for(const [table,cols] of Object.entries(required)){
    const actual=await tableColumns(env,table);
    if(!actual.size){tables[table]="missing";issues.push(`Tabel ${table} belum ada`);continue;}
    const missing=cols.filter(c=>!actual.has(c));
    if(missing.length){tables[table]={status:"missing_columns",columns:missing};issues.push(`Tabel ${table} kekurangan kolom: ${missing.join(", ")}`);}
    else tables[table]="ok";
   }
   let activeUsers=null,invalidCredentialFormats=0;
   if(tables.users==="ok"){
    const accounts=await env.DB.prepare("SELECT username,password_salt,password_hash FROM users WHERE active=1").all();
    const activeRows=accounts.results||[];
    activeUsers=activeRows.length;
    invalidCredentialFormats=activeRows.filter(u=>typeof u.password_salt!=="string"||!/^[a-f0-9]{32}$/i.test(u.password_salt.trim())||typeof u.password_hash!=="string"||!/^[a-f0-9]{64}$/i.test(u.password_hash.trim())).length;
    if(activeUsers===0)issues.push("Tidak ada akun aktif di tabel users");
    if(invalidCredentialFormats>0)issues.push(`${invalidCredentialFormats} akun aktif memiliki format salt/hash yang tidak valid. Jalankan D1_REPAIR_ACCOUNT_CREDENTIALS.sql pada D1 Production.`);
   }
   if(issues.length)return response({ok:false,service:"SIAP APBD API",database:"schema_error",tables,activeUsers,invalidCredentialFormats,issues,message:"Binding DB tersedia, tetapi struktur atau isi database belum sesuai dengan kebutuhan login. Lihat issues."},503,origin);
   return response({ok:true,service:"SIAP APBD API",database:"ready",tables,activeUsers,invalidCredentialFormats,time:new Date().toISOString()},200,origin);
  }catch(e){console.error("SIAP_HEALTH_CHECK_FAILED",{message:e?.message||String(e)});return response({ok:false,service:"SIAP APBD API",database:"query_error",message:"D1 berhasil ditemukan tetapi query pemeriksaan gagal. Buka Functions Logs untuk rincian."},503,origin)}
 }
 if(path==="/api/login"&&req.method==="POST"){
  if(!env?.DB)return response({error:"Binding D1 bernama DB tidak tersedia pada Production."},503,origin);
  const b=await body(req);if(!b||typeof b.username!=="string"||typeof b.password!=="string")return response({error:"Username dan password wajib diisi."},400,origin);
  try{await ensureAuthInfrastructure(env);}catch(e){console.error("LOGIN_INFRASTRUCTURE_FAILED",{message:e?.message||String(e)});return response({error:"Tabel sesi login belum sesuai. Jalankan file D1_REPAIR_LOGIN_SAFE.sql pada database Production, lalu periksa /api/health.",code:"LOGIN_INFRASTRUCTURE"},503,origin)}
  let u;
  try{
   u=await env.DB.prepare("SELECT username,password_salt,password_hash,role,opd_key,scope,must_change_password,active FROM users WHERE username=?").bind(b.username.trim()).first();
  }catch(e){
   console.error("LOGIN_USER_LOOKUP_FAILED",{message:e?.message||String(e)});
   return response({error:"Tabel users belum sesuai dengan kode login (diperlukan username, password_salt, password_hash, role, opd_key, scope, must_change_password, active). Jalankan D1_REPAIR_LOGIN_SAFE.sql pada database yang terikat ke Production.",code:"USERS_SCHEMA"},503,origin);
  }
  if(!u||!u.active)return response({error:"Username/password tidak cocok atau akun tidak aktif. Pastikan akun tersedia pada D1 Production yang sama."},401,origin);
  // Normalize only surrounding whitespace. Never return or log the salt/hash values.
  const saltHex=typeof u.password_salt==="string"?u.password_salt.trim():"";
  const storedHash=typeof u.password_hash==="string"?u.password_hash.trim().toLowerCase():"";
  const credentialDiagnostics={
   saltType:typeof u.password_salt,
   saltLength:saltHex.length,
   saltIsHex:/^[a-f0-9]{32}$/i.test(saltHex),
   hashType:typeof u.password_hash,
   hashLength:storedHash.length,
   hashIsHex:/^[a-f0-9]{64}$/i.test(storedHash)
  };
  if(!credentialDiagnostics.saltIsHex||!credentialDiagnostics.hashIsHex){
   console.error("LOGIN_CREDENTIAL_FORMAT_INVALID",{username:u.username,...credentialDiagnostics});
   const diagnosticText=`saltType=${credentialDiagnostics.saltType}, saltLength=${credentialDiagnostics.saltLength}, saltIsHex=${credentialDiagnostics.saltIsHex}; hashType=${credentialDiagnostics.hashType}, hashLength=${credentialDiagnostics.hashLength}, hashIsHex=${credentialDiagnostics.hashIsHex}`;
   return response({error:`Format kolom kredensial akun yang dibaca API tidak sesuai. Diagnostik aman: ${diagnosticText}. Tidak ada nilai salt/hash yang ditampilkan.`,code:"PASSWORD_CREDENTIAL_FORMAT",diagnostics:credentialDiagnostics},503,origin);
  }
  let computed;
  try{
   computed=await passwordHash(b.password,saltHex);
  }catch(e){
   console.error("LOGIN_PBKDF2_DERIVATION_FAILED",{username:u.username,message:e?.message||String(e)});
   return response({error:"Server gagal menghitung verifikasi password (PBKDF2). Format salt/hash terbaca valid; periksa Cloudflare Functions Logs.",code:"PASSWORD_DERIVATION_FAILED"},500,origin);
  }
  if(!safeEqual(computed,storedHash))return response({error:"Password tidak cocok dengan hash akun pada database yang dibaca API. Ini berbeda dari error format kredensial.",code:"PASSWORD_MISMATCH"},401,origin);
  const token=crypto.randomUUID()+"."+crypto.randomUUID(),expires=Math.floor(Date.now()/1000)+SESSION_SECONDS;
  try{
   await env.DB.prepare("INSERT INTO sessions(token_hash,username,expires_at,created_at) VALUES(?,?,?,?)").bind(await digestHex(token),u.username,expires,Math.floor(Date.now()/1000)).run();
  }catch(e){console.error("LOGIN_SESSION_CREATE_FAILED",{message:e?.message||String(e)});return response({error:"Password benar, tetapi tabel sessions belum sesuai. Jalankan D1_REPAIR_LOGIN_SAFE.sql dan cek /api/health.",code:"SESSIONS_SCHEMA"},503,origin)}
  await log(env,u,"LOGIN");
  return response({token,expiresAt:expires,user:{username:u.username,role:u.role,opdKey:u.opd_key,scope:u.scope,mustChangePassword:!!u.must_change_password}},200,origin);
 }
 const user=await currentUser(req,env);
 if(!user)return response({error:"Sesi tidak valid atau telah berakhir. Silakan login kembali."},401,origin);
 if(path==="/api/logout"&&req.method==="POST"){
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(user.tokenHash).run();await log(env,user,"LOGOUT");return response({ok:true},200,origin);
 }
 if(path==="/api/me"&&req.method==="GET")return response({user:{username:user.username,role:user.role,opdKey:user.opd_key,scope:user.scope,mustChangePassword:!!user.must_change_password}},200,origin);
 if(path==="/api/change-password"&&req.method==="POST"){
  const b=await body(req);if(!b||!validPassword(b.newPassword))return response({error:"Password baru minimal 12 karakter."},400,origin);
  const old=await env.DB.prepare("SELECT password_salt,password_hash FROM users WHERE username=?").bind(user.username).first();
  if(!b.currentPassword||!safeEqual(await passwordHash(b.currentPassword,old.password_salt),old.password_hash))return response({error:"Password saat ini tidak sesuai."},400,origin);
  const salt=crypto.getRandomValues(new Uint8Array(16));const saltHex=[...salt].map(x=>x.toString(16).padStart(2,"0")).join("");
  const hash=await passwordHash(b.newPassword,saltHex);
  await env.DB.prepare("UPDATE users SET password_salt=?,password_hash=?,must_change_password=0,password_changed_at=CURRENT_TIMESTAMP WHERE username=?").bind(saltHex,hash,user.username).run();
  await env.DB.prepare("DELETE FROM sessions WHERE username=?").bind(user.username).run();
  await log(env,user,"PASSWORD_CHANGED");
  return response({ok:true,message:"Password berhasil diganti. Login kembali."},200,origin);
 }
 if(path==="/api/data"&&req.method==="GET"){
  const requested=url.searchParams.get("opd")||"";
  if(user.role==="operator"&&requested&&requested!==user.opd_key)return response({error:"Akses lintas OPD ditolak."},403,origin);
  if(user.role==="operator"){
   const row=await env.DB.prepare("SELECT payload,version,updated_at FROM opd_data WHERE opd_key=?").bind(user.opd_key).first();
   return response({opdKey:user.opd_key,version:row?.version||0,updatedAt:row?.updated_at||null,data:row?JSON.parse(row.payload):null,readOnly:false},200,origin);
  }
  if(!canReadAll(user))return response({error:"Tidak memiliki akses data."},403,origin);
  if(requested){
   const row=await env.DB.prepare("SELECT payload,version,updated_at FROM opd_data WHERE opd_key=?").bind(requested).first();
   return response({opdKey:requested,version:row?.version||0,updatedAt:row?.updated_at||null,data:row?JSON.parse(row.payload):null,readOnly:user.role!=="super_admin"},200,origin);
  }
  const rows=await env.DB.prepare("SELECT opd_key,payload,version,updated_at FROM opd_data ORDER BY opd_key").all();
  return response({datasets:rows.results.map(r=>({opdKey:r.opd_key,data:JSON.parse(r.payload),version:r.version,updatedAt:r.updated_at})),readOnly:user.role!=="super_admin"},200,origin);
 }
 if(path==="/api/data"&&req.method==="PUT"){
  if(user.role!=="operator"&&user.role!=="super_admin")return response({error:"Akun verifikator/auditor hanya dapat membaca dan memverifikasi; tidak dapat mengubah data sumber."},403,origin);
  const b=await body(req);if(!b||typeof b.opdKey!=="string"||!b.data||typeof b.data!=="object")return response({error:"Payload data tidak valid."},400,origin);
  if(user.role==="operator"&&b.opdKey!==user.opd_key)return response({error:"Akses lintas OPD ditolak."},403,origin);
  if(user.role==="operator"){
    const allowed=new Set([user.opd_key]);
    if(!Array.isArray(b.data.opd)||b.data.opd.some(o=>o.id!==user.opd_key))return response({error:"Payload berisi OPD di luar kewenangan akun."},403,origin);
    if(Array.isArray(b.data.sub)&&b.data.sub.some(x=>!allowed.has(x.opdId)))return response({error:"Sub kegiatan di luar OPD akun ditolak."},403,origin);
    for(const k of ["realisasi","rtl","risiko","langkah","rapat"])if(Array.isArray(b.data[k])&&b.data[k].some(x=>x.opdId&&!allowed.has(x.opdId)))return response({error:"Data terkait OPD lain ditolak."},403,origin);
  }
  if(JSON.stringify(b.data).length>2_000_000)return response({error:"Ukuran data melebihi batas 2 MB per OPD."},413,origin);
  const existing=await env.DB.prepare("SELECT version FROM opd_data WHERE opd_key=?").bind(b.opdKey).first();
  const version=existing?.version||0;
  if(Number.isInteger(b.baseVersion)&&b.baseVersion!==version)return response({error:"Konflik perubahan: data telah diperbarui operator lain. Muat ulang sebelum menyimpan.",conflict:true,currentVersion:version},409,origin);
  await env.DB.prepare(`INSERT INTO opd_data(opd_key,payload,version,updated_by,updated_at) VALUES(?,?,1,?,CURRENT_TIMESTAMP)
   ON CONFLICT(opd_key) DO UPDATE SET payload=excluded.payload,version=opd_data.version+1,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`)
   .bind(b.opdKey,JSON.stringify(b.data),user.username).run();
  await log(env,user,"DATA_SAVED",b.opdKey,{baseVersion:version});
  const row=await env.DB.prepare("SELECT version,updated_at FROM opd_data WHERE opd_key=?").bind(b.opdKey).first();
  return response({ok:true,version:row.version,updatedAt:row.updated_at},200,origin);
 }
 if(path==="/api/documents"&&req.method==="GET"){
  const requested=url.searchParams.get("opd")||user.opd_key||"";
  if(user.role==="operator"&&requested!==user.opd_key)return response({error:"Akses lintas OPD ditolak."},403,origin);
  if(!["operator","super_admin","bpkad_verifier"].includes(user.role))return response({error:"Akses dokumen ditolak."},403,origin);
  if(!requested)return response({error:"Parameter opd wajib diisi."},400,origin);
  const r=await env.DB.prepare("SELECT id,opd_key,filename,content_type,size_bytes,drive_web_view_link,uploaded_by,created_at FROM documents WHERE opd_key=? ORDER BY created_at DESC").bind(requested).all();return response({documents:r.results},200,origin);
 }
 if(path==="/api/documents"&&req.method==="POST"){
  if(!["operator","super_admin"].includes(user.role))return response({error:"Hanya operator OPD atau Super Admin yang dapat mengunggah dokumen."},403,origin);
  if(!env.DOCS_R2)return response({error:"Binding R2 DOCS_R2 belum dikonfigurasi."},503,origin);
  const form=await req.formData(),file=form.get("file"),opdKey=String(form.get("opdKey")||user.opd_key||"");
  if(!(file instanceof File)||!file.size)return response({error:"Pilih dokumen terlebih dahulu."},400,origin);
  if(file.size>25*1024*1024)return response({error:"Ukuran dokumen maksimum 25 MB."},413,origin);
  if(user.role==="operator"&&opdKey!==user.opd_key)return response({error:"Akses lintas OPD ditolak."},403,origin);
  if(!opdKey||!/^[a-zA-Z0-9_-]{1,100}$/.test(opdKey))return response({error:"OPD tidak valid."},400,origin);
  const id=crypto.randomUUID(),safeName=file.name.replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,160),key=`${opdKey}/${id}/${safeName}`;
  try{
   await env.DOCS_R2.put(key,file.stream(),{httpMetadata:{contentType:file.type||"application/octet-stream"},customMetadata:{opdKey,documentId:id,uploadedBy:user.username}});
   let drive=null;try{drive=await uploadDrive(env,opdKey,new File([await file.arrayBuffer()],safeName,{type:file.type}),id);}catch(e){await env.DOCS_R2.delete(key);throw e;}
   await env.DB.prepare("INSERT INTO documents(id,opd_key,filename,content_type,size_bytes,r2_key,drive_file_id,drive_web_view_link,uploaded_by) VALUES(?,?,?,?,?,?,?,?,?)").bind(id,opdKey,safeName,file.type||"application/octet-stream",file.size,key,drive.id,drive.webViewLink||null,user.username).run();
   await log(env,user,"DOCUMENT_UPLOADED",opdKey,{id,filename:safeName,size:file.size});return response({ok:true,id,filename:safeName,driveUrl:drive.webViewLink||null,message:"Dokumen tersimpan di R2 dan Google Drive."},201,origin);
  }catch(e){console.error("Document upload",e);return response({error:e.message||"Gagal menyimpan dokumen ke penyimpanan."},502,origin);}
 }
 if(path==="/api/documents/download"&&req.method==="GET"){
  const id=url.searchParams.get("id");if(!id)return response({error:"ID dokumen wajib diisi."},400,origin);
  const doc=await env.DB.prepare("SELECT * FROM documents WHERE id=?").bind(id).first();if(!doc)return response({error:"Dokumen tidak ditemukan."},404,origin);
  if(user.role==="operator"&&doc.opd_key!==user.opd_key)return response({error:"Akses lintas OPD ditolak."},403,origin);
  if(!["operator","super_admin","bpkad_verifier"].includes(user.role))return response({error:"Akses dokumen ditolak."},403,origin);
  const obj=await env.DOCS_R2.get(doc.r2_key);if(!obj)return response({error:"Objek dokumen tidak ditemukan di R2."},404,origin);
  return new Response(obj.body,{headers:{"content-type":doc.content_type,"content-disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(doc.filename),"cache-control":"private, no-store",...corsHeaders(origin)}});
 }
 if(path==="/api/verify"&&req.method==="POST"){
  if(user.role!=="bpkad_verifier")return response({error:"Verifikasi hanya dapat dilakukan oleh akun BPKAD."},403,origin);
  const b=await body(req);
  if(!b||typeof b.opdKey!=="string"||!["diterima","dikembalikan","catatan"].includes(b.status)||typeof b.catatan!=="string"||b.catatan.length>5000)return response({error:"Data verifikasi tidak valid."},400,origin);
  const row=await env.DB.prepare("SELECT payload FROM opd_data WHERE opd_key=?").bind(b.opdKey).first();
  if(!row)return response({error:"Data OPD belum tersedia."},404,origin);
  const data=JSON.parse(row.payload);
  data.verification=data.verification||[];
  data.verification.push({id:crypto.randomUUID(),status:b.status,catatan:b.catatan,oleh:user.username,peran:user.role,waktu:new Date().toISOString()});
  await env.DB.prepare("UPDATE opd_data SET payload=?,version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE opd_key=?").bind(JSON.stringify(data),user.username,b.opdKey).run();
  await log(env,user,"VERIFICATION_"+b.status.toUpperCase(),b.opdKey);
  return response({ok:true},200,origin);
 }
 if(path==="/api/admin/users"&&req.method==="GET"){
  if(user.role!=="super_admin")return response({error:"Khusus Super Admin."},403,origin);
  const rows=await env.DB.prepare("SELECT username,role,opd_key,scope,active,must_change_password,created_at,password_changed_at FROM users ORDER BY role,username").all();
  return response({users:rows.results},200,origin);
 }
 if(path==="/api/admin/users"&&req.method==="POST"){
  if(user.role!=="super_admin")return response({error:"Khusus Super Admin."},403,origin);
  const b=await body(req);if(!b||typeof b.username!=="string"||!/^[-a-zA-Z0-9_.]{3,80}$/.test(b.username)||!validPassword(b.password)||!["operator","bpkad_verifier"].includes(b.role))return response({error:"Data akun tidak valid. Password minimal 12 karakter."},400,origin);
  if(b.role==="operator"&&(typeof b.opdKey!=="string"||!b.opdKey))return response({error:"Operator wajib memiliki OPD."},400,origin);
  const salt=crypto.getRandomValues(new Uint8Array(16)),saltHex=[...salt].map(x=>x.toString(16).padStart(2,"0")).join(""),hash=await passwordHash(b.password,saltHex);
  try{await env.DB.prepare("INSERT INTO users(username,password_salt,password_hash,role,opd_key,scope,must_change_password) VALUES(?,?,?,?,?,?,1)").bind(b.username,saltHex,hash,b.role,b.role==="operator"?b.opdKey:null,b.scope||b.opdKey||"Semua OPD").run();}
  catch{return response({error:"Username sudah digunakan atau data tidak valid."},409,origin)}
  await log(env,user,"USER_CREATED",b.opdKey||null,{username:b.username,role:b.role});
  return response({ok:true},201,origin);
 }
 return response({error:"Endpoint tidak ditemukan."},404,origin);
}
export default {fetch(req,env){return handler(req,env).catch(e=>{console.error("SIAP API error",{path:new URL(req.url).pathname,message:e?.message||String(e),stack:e?.stack});const path=new URL(req.url).pathname;const message=path==="/api/login"?"Server gagal memproses login. Periksa Cloudflare Pages Functions Logs; penyebab umum adalah tabel/kolom D1 belum sesuai atau binding DB menunjuk database yang salah.":"Terjadi kesalahan server.";return response({error:message},500,req.headers.get("origin")||"*")})}};
