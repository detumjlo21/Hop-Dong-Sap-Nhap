const cfg = window.PHOENIX_MERGER_CONFIG || {};
const defaults = window.PHX_SITE_DEFAULTS || {};
const form = document.querySelector('#mergerForm');
const messageEl = document.querySelector('#formMessage');
const submitBtn = document.querySelector('#submitBtn');
const confirmDate = document.querySelector('#confirmDate');
const successPanel = document.querySelector('#successPanel');
let siteContent = {...defaults};

const now = new Date();
confirmDate.textContent = new Intl.DateTimeFormat('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' }).format(now);

function setMessage(text, type=''){
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}
function configured(){
  return cfg.supabaseUrl && cfg.supabaseKey && !cfg.supabaseUrl.includes('PASTE_') && !cfg.supabaseKey.includes('PASTE_');
}
function clean(value){ return String(value || '').trim(); }
function esc(value){return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}

function renderMultiline(el, value){
  const lines = String(value || '').split(/\n+/).map(x=>x.trim()).filter(Boolean);
  el.innerHTML = lines.map((line,i)=> i===0 ? `<p>${esc(line)}</p>` : `<p class="cms-line">${esc(line)}</p>`).join('');
}
function applySiteContent(content){
  siteContent = {...defaults, ...(content || {})};
  document.querySelectorAll('[data-content]').forEach(el=>{
    const key=el.dataset.content;
    if(siteContent[key] == null) return;
    if(el.dataset.multiline === 'true') renderMultiline(el,siteContent[key]);
    else el.textContent=siteContent[key];
  });
  const legionInput=document.querySelector('#legionName');
  if(legionInput && !legionInput.dataset.userEdited) legionInput.value=siteContent.sourceLegion || defaults.sourceLegion;
  document.title = `${siteContent.mainLegion || 'PHOENIX'} — Thỏa thuận Nhánh`;
}
async function loadSiteContent(){
  applySiteContent(defaults);
  if(!configured()) return;
  try{
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    const {data,error}=await sb.from('merger_site_content').select('content').eq('id','main').maybeSingle();
    if(!error && data?.content) applySiteContent(data.content);
  }catch(err){ console.warn('Không tải được nội dung CMS, dùng nội dung mặc định.',err); }
}

document.querySelector('#legionName')?.addEventListener('input',e=>{e.currentTarget.dataset.userEdited='1';});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if(!form.reportValidity()) return;
  if(!configured()){
    setMessage('Chưa cấu hình Supabase trong config.js.', 'error');
    return;
  }
  const checks = ['confirmStructure','confirmLongTerm','confirmDiscipline','confirmRights','confirmFinal'];
  if(checks.some(id => !document.getElementById(id).checked)){
    setMessage('Vui lòng xác nhận đầy đủ các điều khoản bắt buộc.', 'error');
    return;
  }
  submitBtn.disabled = true;
  setMessage('Đang tạo hồ sơ...');
  try{
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    const payload = {
      p_legion_name: clean(document.querySelector('#legionName').value),
      p_current_leader_name: clean(document.querySelector('#currentLeaderName').value),
      p_current_leader_uid: clean(document.querySelector('#currentLeaderUid').value),
      p_member_count: Number(document.querySelector('#memberCount').value),
      p_representative_name: clean(document.querySelector('#representativeName').value),
      p_email: clean(document.querySelector('#email').value) || null,
      p_confirm_structure: true,
      p_confirm_long_term: true,
      p_confirm_discipline: true,
      p_confirm_rights: true,
      p_confirm_final: true
    };
    const { data, error } = await sb.rpc('submit_merger_application', payload);
    if(error) throw error;
    document.querySelector('#agreementCode').textContent = data;
    document.querySelector('#successLegion').textContent = payload.p_legion_name;
    successPanel.hidden = false;
    form.closest('.form-panel').hidden = true;
    successPanel.scrollIntoView({behavior:'smooth', block:'center'});
  }catch(error){
    console.error(error);
    setMessage(error?.message || 'Không thể gửi hồ sơ. Vui lòng thử lại.', 'error');
    submitBtn.disabled = false;
  }
});

document.querySelector('#printBtn').addEventListener('click', () => window.print());
loadSiteContent();
