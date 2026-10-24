'use strict';
const TEAM_LABELS={
 en:['Team chat','Message','Send','No messages yet.','Load older messages','Remove message','Remove this message?','Message removed','Screenshots (optional)','Up to 3 images. JPG, PNG or WebP, up to 10 MB each. Images are resized before upload. Evidence is visible only to you and reviewers. Keep the evidence link.','Remove','Choose up to 3 images.','Choose a JPG, PNG or WebP image smaller than 10 MB.','Could not read this image.','Screenshot','Sending…','Latest messages'],
 ku:['چاتا ئەندامان','پەیام','بفرێکە','هێشتا چ پەیام نینن.','پەیامێن کەڤنتر','پەیامێ بسڕە','ڤێ پەیامێ بسڕی؟','پەیام هاتە ژێبرن','سکرینشۆت (ئارەزوومەندانە)','هەتا ٣ وێنە، JPG، PNG یان WebP؛ هەر ئێک هەتا ١٠ MB. وێنە بەری بارکرنێ بچووک دبن. بتنێ تۆ و پشکنەر دبینن. لینکێ بەڵگەیێ ژی بهێلە.','ژێببە','هەتا ٣ وێنە هەلبژێرە.','وێنەیەکا JPG، PNG یان WebP ژ ١٠ MB بچووکتر هەلبژێرە.','ڤەکرنا وێنەیێ نەچوو سەر.','سکرینشۆت','د فرێکرنێ دایە…','پەیامێن نوو'],
 ar:['دردشة الفريق','رسالة','إرسال','لا توجد رسائل بعد.','تحميل رسائل أقدم','حذف الرسالة','حذف هذه الرسالة؟','تم حذف الرسالة','لقطات شاشة (اختياري)','حتى 3 صور JPG أو PNG أو WebP، بحد أقصى 10 MB لكل صورة. تُصغّر قبل الرفع. لا يراها إلا أنت والمراجعون. احتفظ برابط الدليل.','إزالة','اختر حتى 3 صور.','اختر صورة JPG أو PNG أو WebP أصغر من 10 MB.','تعذر قراءة الصورة.','لقطة شاشة','جارٍ الإرسال…','أحدث الرسائل'],
 tr:['Ekip sohbeti','Mesaj','Gönder','Henüz mesaj yok.','Eski mesajları yükle','Mesajı kaldır','Bu mesaj kaldırılsın mı?','Mesaj kaldırıldı','Ekran görüntüleri (isteğe bağlı)','En fazla 3 JPG, PNG veya WebP; her biri en fazla 10 MB. Yüklemeden önce küçültülür. Yalnızca siz ve inceleyenler görebilir. Kanıt bağlantısını koruyun.','Kaldır','En fazla 3 resim seçin.','10 MB altında JPG, PNG veya WebP seçin.','Resim okunamadı.','Ekran görüntüsü','Gönderiliyor…','Son mesajlar'],
 fa:['گفتگوی تیم','پیام','ارسال','هنوز پیامی نیست.','پیام‌های قدیمی‌تر','حذف پیام','این پیام حذف شود؟','پیام حذف شد','تصاویر مدرک (اختیاری)','حداکثر ۳ تصویر JPG، PNG یا WebP، هر یک تا ۱۰ MB. پیش از بارگذاری کوچک می‌شوند. فقط شما و بررسی‌کنندگان می‌بینید. پیوند مدرک را نگه دارید.','حذف','حداکثر ۳ تصویر انتخاب کنید.','تصویر JPG، PNG یا WebP کمتر از ۱۰ MB انتخاب کنید.','خواندن تصویر ممکن نشد.','تصویر مدرک','در حال ارسال…','آخرین پیام‌ها'],
 es:['Chat del equipo','Mensaje','Enviar','Todavía no hay mensajes.','Cargar mensajes anteriores','Eliminar mensaje','¿Eliminar este mensaje?','Mensaje eliminado','Capturas (opcional)','Hasta 3 imágenes JPG, PNG o WebP, de hasta 10 MB cada una. Se reducen antes de subirlas. Solo tú y los revisores pueden verlas. Conserva el enlace de prueba.','Quitar','Elige hasta 3 imágenes.','Elige un JPG, PNG o WebP de menos de 10 MB.','No se pudo leer la imagen.','Captura','Enviando…','Últimos mensajes'],
 fr:['Discussion de l’équipe','Message','Envoyer','Aucun message pour le moment.','Charger les anciens messages','Supprimer le message','Supprimer ce message ?','Message supprimé','Captures (facultatif)','Jusqu’à 3 images JPG, PNG ou WebP de 10 MB chacune. Elles sont réduites avant l’envoi. Seuls vous et les réviseurs les voient. Conservez le lien de preuve.','Retirer','Choisissez au plus 3 images.','Choisissez un JPG, PNG ou WebP de moins de 10 MB.','Impossible de lire cette image.','Capture','Envoi…','Derniers messages']
};
function teamText(i){return (TEAM_LABELS[currentLanguage]||TEAM_LABELS.en)[i];}
function screenshotView(ids=[]){return ids.length?`<div class="evidence-gallery">${ids.map(id=>`<div><a href="/api/evidence/${esc(id)}" target="_blank" rel="noopener noreferrer"><img data-evidence-image src="/api/evidence/${esc(id)}" loading="lazy" alt="${esc(teamText(14))}"></a><video hidden controls preload="none" style="max-width:100%;max-height:260px" src="/api/evidence/${esc(id)}"></video></div>`).join('')}</div>`:'';}
function screenshotFields(ids=[]){return `<div class="field" id="screenshotFields"><label for="evidenceFiles">${teamText(8)}</label><p class="muted">${teamText(9)}</p><div class="evidence-gallery">${ids.map(id=>`<div data-existing-evidence="${esc(id)}">${screenshotView([id])}<button type="button" class="secondary" data-remove-evidence>${teamText(10)}</button></div>`).join('')}</div><input id="evidenceFiles" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple><small id="evidenceSelection" data-user-text></small></div>`;}
async function screenshotJpeg(file){
 if(['video/mp4','video/webm'].includes(file.type)){if(file.size>20*1024*1024)throw Error('Video must be 20 MB or smaller.');return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error(teamText(13)));r.readAsDataURL(file);});}
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error(teamText(12));
 const image=new Image();const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error(teamText(13)));r.readAsDataURL(file);});
 await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error(teamText(13)));image.src=url;});
 if(!image.width||!image.height)throw Error(teamText(13));
 const scale=Math.min(1,1600/image.width,1600/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
 for(const quality of [.88,.75,.6,.45]){const result=canvas.toDataURL('image/jpeg',quality);if(result.length<1300000)return result;}throw Error(teamText(12));
}
const evidenceUploaded=new WeakMap();
async function collectScreenshots(){const field=document.getElementById('screenshotFields');if(!field)return [];const ids=[...field.querySelectorAll('[data-existing-evidence]')].map(e=>e.dataset.existingEvidence);const input=field.querySelector('input');const files=[...input.files];if(ids.length+files.length>3)throw Error(teamText(11));input.disabled=true;try{for(const file of files){let id=evidenceUploaded.get(file);if(!id){const image=await screenshotJpeg(file);id=(await api('/api/evidence',{method:'POST',body:JSON.stringify({media:image})})).id;evidenceUploaded.set(file,id);}ids.push(id);}return [...new Set(ids)];}finally{input.disabled=false;}}
let chatTimer;
function openTeamChat(){
 clearInterval(chatTimer);const userId=currentUser.id;let requestKey=crypto.randomUUID(),busy=false,older=false,stamp='';
 modal(teamText(0),`<button type="button" class="secondary" id="chatOlder">${teamText(4)}</button> <button type="button" class="secondary" id="chatLatest">${teamText(16)}</button><div id="chatMessages" role="log" aria-live="polite"></div><div class="field"><label for="chatText">${teamText(1)}</label><textarea id="chatText" name="text" required maxlength="2000" rows="3"></textarea></div>`,teamText(2),async b=>{await api('/api/chat',{method:'POST',body:JSON.stringify({text:b.text,requestKey})});requestKey=crypto.randomUUID();if(form.isConnected){form.querySelector('#chatText').value='';older=false;await refresh();}return false;});
 const form=document.getElementById('actionForm'),log=form.querySelector('#chatMessages');let first=null;
 const active=()=>form.isConnected&&currentUser?.id===userId;
 async function refresh(before){if(busy||!active())return;busy=true;try{const result=await api('/api/chat'+(before?'?before='+before:''));if(!active())return;const sig=JSON.stringify(result)+currentLanguage;if(sig===stamp)return;stamp=sig;const nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<80;first=result.messages[0]?.seq;log.innerHTML=result.messages.map(m=>`<article class="chat-message"><b data-user-text>${esc(data.members.find(u=>u.id===m.memberId)?.name||'Member')}</b><small>${esc(new Date(m.createdAt).toLocaleString(locale(),{timeZone:'Asia/Baghdad'}))}</small><p data-user-text dir="auto">${esc(m.deletedAt?teamText(7):m.text)}</p>${!m.deletedAt&&['Owner','Manager'].includes(currentUser.role)?`<button type="button" class="text-button" data-chat-remove="${esc(m.id)}">${teamText(5)}</button>`:''}</article>`).join('')||`<p>${teamText(3)}</p>`;form.querySelector('#chatOlder').disabled=!result.hasMore;if(!older&&nearBottom)log.scrollTop=log.scrollHeight;}catch(e){if(active())form.querySelector('#formError').textContent=translateLabel(e.message);}finally{busy=false;}}
 form.querySelector('#chatOlder').onclick=()=>{older=true;refresh(first);};form.querySelector('#chatLatest').onclick=()=>{older=false;stamp='';refresh();};
 form.addEventListener('click',async e=>{const b=e.target.closest('[data-chat-remove]');if(!b||!confirm(teamText(6)))return;b.disabled=true;try{await api('/api/chat/remove',{method:'POST',body:JSON.stringify({id:b.dataset.chatRemove})});older=false;stamp='';await refresh();}catch(err){if(active())form.querySelector('#formError').textContent=translateLabel(err.message);}finally{b.disabled=false;}});
 refresh();chatTimer=setInterval(()=>{if(!active()){clearInterval(chatTimer);return;}if(!document.hidden&&!older)refresh();},5000);
}
function installTeamTools(){
 document.addEventListener('error',e=>{if(e.target.matches?.('[data-evidence-image]')){const anchor=e.target.parentElement,video=anchor.nextElementSibling;anchor.hidden=true;if(video?.tagName==='VIDEO')video.hidden=false;}},true);
 for(const [lang,values]of Object.entries(TEAM_LABELS)){if(lang==='en')continue;Object.assign(UI_TEXT[lang]??={},Object.fromEntries(TEAM_LABELS.en.map((key,i)=>[key,values[i]])));}
 document.addEventListener('click',e=>{if(e.target.closest('[data-team-chat]'))openTeamChat();const remove=e.target.closest('[data-remove-evidence]');if(remove){remove.closest('[data-existing-evidence]').remove();document.getElementById('evidenceFiles').dispatchEvent(new Event('change',{bubbles:true}));}});
 document.addEventListener('change',e=>{if(e.target.id==='evidenceFiles'){const files=[...e.target.files];document.getElementById('evidenceSelection').textContent=files.map(f=>f.name).join(', ');e.target.setCustomValidity(files.length+document.querySelectorAll('[data-existing-evidence]').length>3?teamText(11):'');}});
}

TEAM_LABELS.en[8]='Photos / videos';TEAM_LABELS.en[9]='Up to 3 files: JPG/PNG/WebP images up to 10 MB; MP4/WebM videos up to 20 MB. Only you and reviewers can view evidence.';
TEAM_LABELS.ku[8]='وێنە / ڤیدیۆ';TEAM_LABELS.ku[9]='هەتا ٣ فایل: وێنە هەتا ١٠ MB، ڤیدیۆ MP4/WebM هەتا ٢٠ MB. بتنێ تۆ و پشکنەر بەڵگەیان دبینن.';
TEAM_LABELS.ar[8]='صور / فيديو';TEAM_LABELS.ar[9]='حتى 3 ملفات: صور حتى 10 MB وفيديو MP4/WebM حتى 20 MB. الأدلة لك وللمراجعين فقط.';

const WORK_LABELS={
'Offline activity':['چالاکیا دەرڤەی سۆشال میدیا','نشاط خارج وسائل التواصل'],
'Work reviews':['پشکنینا کاران','مراجعة الأعمال'],
'Purchase reviews':['پشکنینا کرینان','مراجعة المشتريات'],
'Work type':['جۆرێ کاری','نوع العمل'],
'Social media work':['کارێ سۆشال میدیایێ','عمل وسائل التواصل'],
'Work location':['جهێ کاری','مكان العمل'],
'Work date':['مێژوویا کاری','تاريخ العمل'],
'Describe the work and result':['کار و ئەنجامێ وێ ڕوون بکە','اشرح العمل ونتيجته'],
'Attach a photo or video. Offline work is reviewed separately; rewards are set after review.':['وێنە یان ڤیدیۆ بار بکە. ئەڤ کارە جودا دهێتە پشکنین؛ پاداشت پشتی پشکنینێ دیار دبیت.','أرفق صورة أو فيديو. يراجع النشاط بشكل مستقل وتحدد مكافأته بعد المراجعة.'],
'Page approval, work approval and purchase verification are separate.':['پشتڕاستکرنا پەیجێ، کاری و کرینێ هەر ئێک جودا یە.','اعتماد الصفحات والأعمال والمشتريات إجراءات منفصلة.'],
'Verification method':['ڕێکا پشتڕاستکرنێ','طريقة التحقق'],
'Order receipt available':['وەسل یان ژمارەیا مامەڵەیێ هەیە','يوجد إيصال أو رقم طلب'],
'No receipt — owner review':['بێ وەسل — پشکنینا خاوەنی','بلا إيصال — مراجعة المالك'],
'Buyer, seller, purchase date and verification details':['کریار، فرۆشیار، مێژوویا کرینێ و وردەکاریێن پشکنینێ','المشتري والبائع وتاريخ الشراء وتفاصيل التحقق'],
'No commission until the owner checks the purchase. Do not invent a receipt number.':['هەتا خاوەن کرینێ نەپشکنیت کۆمیسیۆن ناهێتە دان. ژمارەیا ساختە بکار نەئینە.','لا عمولة حتى يتحقق المالك من الشراء. لا تخترع رقم إيصال.'],
'Manual approval requires the owner and a written explanation of how payment was checked.':['پشتڕاستکرنا دەستی پێدڤی ب خاوەنی و ڕوونکرنا چەوانیا پشکنینا پارەدانێ هەیە.','الاعتماد اليدوي للمالك مع شرح مكتوب لكيفية التحقق من الدفع.'],
'Buyer name or account (not transaction number)':['ناڤ یان هەژمارا کریاری (نە ژمارەیا مامەڵەیێ)','اسم المشتري أو حسابه (وليس رقم المعاملة)']
};
const baseInstallTeamTools=installTeamTools;
installTeamTools=function(){for(const [key,v]of Object.entries(WORK_LABELS)){(UI_TEXT.ku??={})[key]=v[0];(UI_TEXT.ar??={})[key]=v[1];}baseInstallTeamTools();};
