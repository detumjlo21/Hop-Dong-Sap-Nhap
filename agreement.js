const cfg=window.PHOENIX_MERGER_CONFIG||{};
const defaults=window.PHX_SITE_DEFAULTS||{};
const msg=document.querySelector('#docMessage');
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function fmt(v){return v?new Intl.DateTimeFormat('vi-VN',{dateStyle:'long',timeStyle:'short'}).format(new Date(v)):'—';}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v||'—';}
function setLogo(id,url){const el=document.getElementById(id);if(!el)return;if(url){el.src=url;el.hidden=false;}else{el.hidden=true;}}
function render(data){
  const c={...defaults,...(data.agreement_snapshot||{})};
  setText('docCode',data.agreement_code);setText('docMetaCode',data.agreement_code);setText('docSealCode',data.agreement_code);
  setText('docTitle',c.agreementTitle);setText('docSubtitle',c.agreementSubtitle);setText('docMainLegion',c.mainLegion);setText('docSourceLegion',data.legion_name||c.sourceLegion);setText('docTargetBranch',c.targetBranch);
  setLogo('docLogoA',c.partyALogoUrl||'assets/logo.png');setLogo('docLogoB',c.partyBLogoUrl||'');
  setText('docRepresentative',data.representative_name);setText('docSignatureName',data.representative_name);setText('docDate',fmt(data.confirmed_at||data.created_at));setText('docLeader',data.current_leader_name);setText('docLeaderUid',data.current_leader_uid);setText('docTermsHeading',c.termsHeading);
  const terms=[1,2,3,4,5,6].map(i=>({title:c[`term${i}Title`],body:c[`term${i}Body`]}));
  document.querySelector('#docTerms').innerHTML=terms.map((t,i)=>`<article class="doc-term"><div class="doc-term-num">${String(i+1).padStart(2,'0')}</div><div><h3>${esc(t.title)}</h3>${String(t.body||'').split(/\n+/).filter(Boolean).map(x=>`<p>${esc(x)}</p>`).join('')}</div></article>`).join('');
  msg.textContent='';
}
(async()=>{
  const code=new URLSearchParams(location.search).get('code');if(!code){msg.textContent='Thiếu mã hồ sơ.';msg.className='message error';return;}
  try{const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);const {data,error}=await sb.rpc('get_merger_agreement_document',{p_code:code});if(error)throw error;if(!data)throw new Error('Không tìm thấy bản thỏa thuận.');render(data);}catch(e){msg.textContent=e.message||'Không tải được thỏa thuận.';msg.className='message error';}
})();
const printBtn=document.querySelector('#docPrintBtn');
if(printBtn){
  printBtn.addEventListener('click',async()=>{
    const old=printBtn.textContent;
    printBtn.disabled=true;
    printBtn.textContent='ĐANG CHUẨN BỊ PDF...';
    try{
      if(document.fonts?.ready) await document.fonts.ready;
      const imgs=[...document.querySelectorAll('#agreementDocument img')].filter(img=>!img.hidden && img.src);
      await Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,2500);}))); 
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      window.print();
    }finally{
      setTimeout(()=>{printBtn.disabled=false;printBtn.textContent=old;},500);
    }
  });
}

