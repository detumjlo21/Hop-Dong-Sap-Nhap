const cfg = window.PHOENIX_MERGER_CONFIG || {};
const defaults = window.PHX_SITE_DEFAULTS || {};
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
let applications = [];
let activeApplication = null;

const loginPanel = document.querySelector('#loginPanel');
const adminArea = document.querySelector('#adminArea');
const loginMessage = document.querySelector('#loginMessage');
const adminMessage = document.querySelector('#adminMessage');
const applicationsEl = document.querySelector('#applications');
const modal = document.querySelector('#detailModal');
const contentForm = document.querySelector('#contentForm');
const contentMessage = document.querySelector('#contentMessage');

function esc(value){return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
function msg(el,text,type=''){el.textContent=text;el.className=`message ${type}`;}
function fmtDate(v){if(!v)return '—';return new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));}
function statusLabel(s){return ({pending:'CHỜ PHOENIX KÝ',approved:'ĐÃ KÝ ĐỦ 2 BÊN',rejected:'TỪ CHỐI',locked:'ĐÃ KHÓA'})[s] || s;}

async function verifyAdmin(){
  const {data:{user}} = await sb.auth.getUser();
  if(!user) return false;
  const {data,error} = await sb.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();
  return !error && !!data;
}
async function syncUI(){
  const ok = await verifyAdmin();
  loginPanel.hidden = ok; adminArea.hidden = !ok;
  if(ok) await Promise.all([loadApplications(),loadSiteContent()]);
}

document.querySelector('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); msg(loginMessage,'Đang đăng nhập...');
  const email = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;
  const {error} = await sb.auth.signInWithPassword({email,password});
  if(error){msg(loginMessage,'Email hoặc mật khẩu không đúng.','error');return;}
  if(!(await verifyAdmin())){await sb.auth.signOut();msg(loginMessage,'Tài khoản chưa được cấp quyền Admin.','error');return;}
  msg(loginMessage,''); await syncUI();
});
document.querySelector('#logoutBtn').addEventListener('click', async()=>{await sb.auth.signOut();await syncUI();});
document.querySelector('#refreshBtn').addEventListener('click', loadApplications);
document.querySelector('#searchInput').addEventListener('input', renderApplications);
document.querySelector('#statusFilter').addEventListener('change', renderApplications);

document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));
function closeModal(){modal.hidden=true;activeApplication=null;}

function setAdminTab(name){
  document.querySelectorAll('[data-admin-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.adminTab===name));
  document.querySelectorAll('[data-admin-panel]').forEach(panel=>panel.hidden=panel.dataset.adminPanel!==name);
}
document.querySelectorAll('[data-admin-tab]').forEach(btn=>btn.addEventListener('click',()=>setAdminTab(btn.dataset.adminTab)));

document.querySelector('#resetContentBtn').addEventListener('click',()=>{
  if(!confirm('Khôi phục các ô về nội dung mặc định trong source? Bạn vẫn cần bấm LƯU NỘI DUNG để áp dụng.')) return;
  fillContentForm(defaults); msg(contentMessage,'Đã nạp nội dung mặc định. Bấm LƯU NỘI DUNG để áp dụng.','success');
});

async function loadSiteContent(){
  msg(contentMessage,'Đang tải nội dung website...');
  const {data,error}=await sb.from('merger_site_content').select('content,updated_at').eq('id','main').maybeSingle();
  if(error){msg(contentMessage,`Không tải được CMS: ${error.message}`,'error');fillContentForm(defaults);return;}
  fillContentForm({...defaults,...(data?.content||{})});
  msg(contentMessage,data?.updated_at?`Nội dung cập nhật gần nhất: ${fmtDate(data.updated_at)}`:'Đang dùng nội dung mặc định.','');
}
function fillContentForm(content){
  contentForm.querySelectorAll('[name]').forEach(el=>{ if(content[el.name] != null) el.value=content[el.name]; });
}
contentForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const content={};
  contentForm.querySelectorAll('[name]').forEach(el=>content[el.name]=el.value.trim());
  msg(contentMessage,'Đang lưu nội dung...');
  const {data:{user}}=await sb.auth.getUser();
  const {error}=await sb.from('merger_site_content').upsert({id:'main',content,updated_at:new Date().toISOString(),updated_by:user?.id||null},{onConflict:'id'});
  if(error){msg(contentMessage,error.message,'error');return;}
  msg(contentMessage,'Đã lưu. Trang public sẽ hiển thị nội dung mới ngay khi tải lại.','success');
});

document.querySelector('#previewSiteBtn').addEventListener('click',()=>window.open('index.html','_blank','noopener'));

async function loadApplications(){
  msg(adminMessage,'Đang tải hồ sơ...');
  const {data,error}=await sb.from('merger_applications').select('*').order('created_at',{ascending:false});
  if(error){msg(adminMessage,error.message,'error');return;}
  applications=data||[]; msg(adminMessage,''); renderStats(); renderApplications();
}
function renderStats(){
  document.querySelector('#totalCount').textContent=applications.length;
  document.querySelector('#pendingCount').textContent=applications.filter(x=>x.status==='pending').length;
  document.querySelector('#approvedCount').textContent=applications.filter(x=>x.status==='approved').length;
  document.querySelector('#lockedCount').textContent=applications.filter(x=>x.status==='locked').length;
}
function renderApplications(){
  const q=document.querySelector('#searchInput').value.trim().toLowerCase();
  const status=document.querySelector('#statusFilter').value;
  const rows=applications.filter(x=>{
    const hay=`${x.agreement_code} ${x.legion_name} ${x.current_leader_name} ${x.current_leader_uid} ${x.representative_name}`.toLowerCase();
    return (!q||hay.includes(q))&&(!status||x.status===status);
  });
  applicationsEl.innerHTML=rows.length?rows.map(x=>`<article class="application-card">
    <div class="application-main"><div class="application-meta"><span class="status-badge ${esc(x.status)}">${esc(statusLabel(x.status))}</span><span class="status-badge">${esc(x.agreement_code)}</span></div><h3>${esc(x.legion_name)}</h3><p>Đại diện: <b>${esc(x.representative_name)}</b> • UID Chủ QĐ: <b>${esc(x.current_leader_uid)}</b></p><p>${esc(fmtDate(x.created_at))}</p></div>
    <div class="application-actions"><button class="secondary mini-btn" data-view="${esc(x.id)}">XEM HỒ SƠ</button></div>
  </article>`).join(''):'<p class="muted">Không có hồ sơ phù hợp.</p>';
  applicationsEl.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>openModal(btn.dataset.view)));
}
function openModal(id){
  activeApplication=applications.find(x=>x.id===id); if(!activeApplication)return;
  const x=activeApplication;
  document.querySelector('#modalTitle').textContent=x.agreement_code;
  document.querySelector('#modalContent').innerHTML=`
    <div class="detail-grid">
      <div class="detail-item"><span>Quân Đoàn</span><strong>${esc(x.legion_name)}</strong></div>
      <div class="detail-item"><span>Trạng thái</span><strong>${esc(statusLabel(x.status))}</strong></div>
      <div class="detail-item"><span>Chủ QĐ hiện tại</span><strong>${esc(x.current_leader_name)}</strong></div>
      <div class="detail-item"><span>UID Chủ QĐ</span><strong>${esc(x.current_leader_uid)}</strong></div>
      <div class="detail-item"><span>Quy mô thành viên hiện tại</span><strong>${esc(x.member_count)}</strong></div>
      <div class="detail-item"><span>Người đại diện</span><strong>${esc(x.representative_name)}</strong></div>
      <div class="detail-item"><span>Email</span><strong>${esc(x.email||'—')}</strong></div>
      <div class="detail-item"><span>Ngày xác nhận</span><strong>${esc(fmtDate(x.created_at))}</strong></div>
    </div>
    <div class="confirm-list"><p>✓ Cơ cấu quản lý: ${x.management_confirmed?'Đã xác nhận':'Chưa xác nhận'}</p><p>✓ Cam kết lâu dài: ${x.long_term_confirmed?'Đã xác nhận':'Chưa xác nhận'}</p><p>✓ Kỷ luật: ${x.discipline_confirmed?'Đã xác nhận':'Chưa xác nhận'}</p><p>✓ Quyền & trách nhiệm: ${x.rights_confirmed?'Đã xác nhận':'Chưa xác nhận'}</p><p>✓ Xác nhận cuối: ${x.final_confirmed?'Đã xác nhận':'Chưa xác nhận'}</p></div>`;
  const actions=document.querySelector('#modalActions');
  actions.innerHTML=`<button data-status="approved">KÝ XÁC NHẬN BÊN PHOENIX</button><button class="danger" data-status="rejected">TỪ CHỐI</button><button class="secondary" data-status="locked">KHÓA HỒ SƠ</button>${x.status!=='pending'?'<button class="secondary" data-status="pending">ĐƯA VỀ CHỜ PHOENIX KÝ</button>':''}`;
  actions.querySelectorAll('[data-status]').forEach(btn=>btn.addEventListener('click',()=>updateStatus(btn.dataset.status)));
  modal.hidden=false;
}
async function updateStatus(status){
  if(!activeApplication)return;
  const {data:{user}}=await sb.auth.getUser();
  const {error}=await sb.from('merger_applications').update({status,updated_at:new Date().toISOString(),reviewed_at:new Date().toISOString(),reviewed_by:user?.id||null}).eq('id',activeApplication.id);
  if(error){alert(error.message);return;}
  closeModal(); await loadApplications();
}

syncUI();
