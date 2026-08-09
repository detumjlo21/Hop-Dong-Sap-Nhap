const cfg = window.PHOENIX_MERGER_CONFIG || {};
const defaults = window.PHX_SITE_DEFAULTS || {};
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
let applications = [];
let activeApplication = null;
let currentContent = {...defaults};

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
function statusLabel(s){return ({pending:'ĐÃ GỬI / CHỜ XỬ LÝ',approved:'ĐÃ XÁC NHẬN',rejected:'ĐÃ HỦY',locked:'ĐÃ KHÓA'})[s] || s;}

async function verifyAdmin(){
  const {data:{user}}=await sb.auth.getUser(); if(!user)return false;
  const {data,error}=await sb.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();
  return !error&&!!data;
}
async function syncUI(){const ok=await verifyAdmin();loginPanel.hidden=ok;adminArea.hidden=!ok;if(ok)await Promise.all([loadApplications(),loadSiteContent()]);}

document.querySelector('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();msg(loginMessage,'Đang đăng nhập...');
  const email=document.querySelector('#email').value.trim();const password=document.querySelector('#password').value;
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error){msg(loginMessage,'Email hoặc mật khẩu không đúng.','error');return;}
  if(!(await verifyAdmin())){await sb.auth.signOut();msg(loginMessage,'Tài khoản chưa được cấp quyền Admin.','error');return;}
  msg(loginMessage,'');await syncUI();
});
document.querySelector('#logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();await syncUI();});
document.querySelector('#refreshBtn').addEventListener('click',loadApplications);
document.querySelector('#searchInput').addEventListener('input',renderApplications);
document.querySelector('#statusFilter').addEventListener('change',renderApplications);
document.querySelectorAll('[data-close-modal]').forEach(el=>el.addEventListener('click',closeModal));
function closeModal(){modal.hidden=true;activeApplication=null;}

function setAdminTab(name){document.querySelectorAll('[data-admin-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.adminTab===name));document.querySelectorAll('[data-admin-panel]').forEach(panel=>panel.hidden=panel.dataset.adminPanel!==name);}
document.querySelectorAll('[data-admin-tab]').forEach(btn=>btn.addEventListener('click',()=>setAdminTab(btn.dataset.adminTab)));

document.querySelector('#resetContentBtn').addEventListener('click',()=>{if(!confirm('Nạp lại mẫu mặc định? Bạn vẫn cần bấm LƯU NỘI DUNG để áp dụng.'))return;fillContentForm(defaults);msg(contentMessage,'Đã nạp mẫu mặc định. Bấm LƯU để áp dụng.','success');});

function updateLogoPreview(which,url){
  const img=document.querySelector(which==='A'?'#cmsLogoAPreview':'#cmsLogoBPreview');
  if(!img)return;
  if(url){img.src=url;img.hidden=false;}else{img.removeAttribute('src');img.hidden=true;}
}
async function uploadLogo(which,file){
  if(!file)return;
  if(file.size>3*1024*1024){msg(contentMessage,'Logo tối đa 3MB.','error');return;}
  const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'');
  const path=`templates/${which.toLowerCase()}-${Date.now()}.${ext}`;
  msg(contentMessage,`Đang tải logo Bên ${which}...`);
  const {error}=await sb.storage.from('merger-assets').upload(path,file,{upsert:false,contentType:file.type||undefined});
  if(error){msg(contentMessage,`Không tải được logo: ${error.message}`,'error');return;}
  const {data}=sb.storage.from('merger-assets').getPublicUrl(path);
  const url=data?.publicUrl||'';
  const hidden=document.querySelector(which==='A'?'#cms_partyALogoUrl':'#cms_partyBLogoUrl');
  hidden.value=url;updateLogoPreview(which,url);msg(contentMessage,`Đã tải logo Bên ${which}. Bấm LƯU NỘI DUNG để áp dụng.`,'success');
}
document.querySelector('#cms_partyALogoFile')?.addEventListener('change',e=>uploadLogo('A',e.target.files?.[0]));
document.querySelector('#cms_partyBLogoFile')?.addEventListener('change',e=>uploadLogo('B',e.target.files?.[0]));

async function loadSiteContent(){
  msg(contentMessage,'Đang tải mẫu thỏa thuận...');
  const {data,error}=await sb.from('merger_site_content').select('content,updated_at').eq('id','main').maybeSingle();
  if(error){msg(contentMessage,`Không tải được CMS: ${error.message}`,'error');fillContentForm(defaults);return;}
  currentContent={...defaults,...(data?.content||{})};fillContentForm(currentContent);
  msg(contentMessage,data?.updated_at?`Mẫu cập nhật gần nhất: ${fmtDate(data.updated_at)}`:'Đang dùng mẫu mặc định.','');
}
function fillContentForm(content){
  contentForm.querySelectorAll('[name]').forEach(el=>{if(content[el.name]!=null)el.value=content[el.name];});
  updateLogoPreview('A',content.partyALogoUrl||'assets/logo.png');updateLogoPreview('B',content.partyBLogoUrl||'');
}
contentForm.addEventListener('submit',async e=>{
  e.preventDefault();const content={};contentForm.querySelectorAll('[name]').forEach(el=>content[el.name]=el.value.trim());
  msg(contentMessage,'Đang lưu mẫu thỏa thuận...');
  const {data:{user}}=await sb.auth.getUser();
  const {error}=await sb.from('merger_site_content').upsert({id:'main',content,updated_at:new Date().toISOString(),updated_by:user?.id||null},{onConflict:'id'});
  if(error){msg(contentMessage,error.message,'error');return;}
  currentContent={...defaults,...content};msg(contentMessage,'Đã lưu. Trang public sẽ dùng mẫu mới sau khi tải lại. Các hồ sơ cũ không bị thay đổi.','success');
});
document.querySelector('#previewSiteBtn').addEventListener('click',()=>window.open('index.html','_blank','noopener'));

async function loadApplications(){
  msg(adminMessage,'Đang tải hồ sơ...');
  const {data,error}=await sb.from('merger_applications').select('*').order('created_at',{ascending:false});
  if(error){msg(adminMessage,error.message,'error');return;}
  applications=data||[];msg(adminMessage,'');renderStats();renderApplications();
}
function renderStats(){document.querySelector('#totalCount').textContent=applications.length;document.querySelector('#pendingCount').textContent=applications.filter(x=>x.status==='pending').length;document.querySelector('#approvedCount').textContent=applications.filter(x=>x.status==='approved').length;document.querySelector('#lockedCount').textContent=applications.filter(x=>x.status==='locked').length;}
function renderApplications(){
  const q=document.querySelector('#searchInput').value.trim().toLowerCase();const status=document.querySelector('#statusFilter').value;
  const rows=applications.filter(x=>{const hay=`${x.agreement_code} ${x.legion_name} ${x.current_leader_name} ${x.current_leader_uid} ${x.representative_name}`.toLowerCase();return(!q||hay.includes(q))&&(!status||x.status===status);});
  applicationsEl.innerHTML=rows.length?rows.map(x=>`<article class="application-card"><div class="application-main"><div class="application-meta"><span class="status-badge ${esc(x.status)}">${esc(statusLabel(x.status))}</span><span class="status-badge">${esc(x.agreement_code)}</span></div><h3>${esc(x.legion_name)}</h3><p>Đại diện: <b>${esc(x.representative_name)}</b> • UID Chủ QĐ: <b>${esc(x.current_leader_uid)}</b></p><p>${esc(fmtDate(x.confirmed_at||x.created_at))}</p></div><div class="application-actions"><a class="button-link secondary mini-btn" href="agreement.html?code=${encodeURIComponent(x.agreement_code)}" target="_blank">BẢN ĐIỆN TỬ</a><button class="secondary mini-btn" data-view="${esc(x.id)}">CHI TIẾT</button></div></article>`).join(''):'<p class="muted">Không có hồ sơ phù hợp.</p>';
  applicationsEl.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>openModal(btn.dataset.view)));
}
function openModal(id){
  activeApplication=applications.find(x=>x.id===id);if(!activeApplication)return;const x=activeApplication;const snap=x.agreement_snapshot||{};
  document.querySelector('#modalTitle').textContent=x.agreement_code;
  document.querySelector('#modalContent').innerHTML=`<div class="detail-grid"><div class="detail-item"><span>Quân Đoàn</span><strong>${esc(x.legion_name)}</strong></div><div class="detail-item"><span>Trạng thái</span><strong>${esc(statusLabel(x.status))}</strong></div><div class="detail-item"><span>Quân Đoàn chính</span><strong>${esc(snap.mainLegion||'—')}</strong></div><div class="detail-item"><span>Nhánh sau xác nhận</span><strong>${esc(snap.targetBranch||'—')}</strong></div><div class="detail-item"><span>Chủ QĐ hiện tại</span><strong>${esc(x.current_leader_name)}</strong></div><div class="detail-item"><span>UID Chủ QĐ</span><strong>${esc(x.current_leader_uid)}</strong></div><div class="detail-item"><span>Quy mô thành viên</span><strong>${esc(x.member_count)}</strong></div><div class="detail-item"><span>Người đại diện</span><strong>${esc(x.representative_name)}</strong></div><div class="detail-item"><span>Email</span><strong>${esc(x.email||'—')}</strong></div><div class="detail-item"><span>Ngày xác nhận</span><strong>${esc(fmtDate(x.confirmed_at||x.created_at))}</strong></div></div><div class="confirm-list"><p>✓ Cơ cấu quản lý: ${x.management_confirmed?'Đã xác nhận':'Chưa xác nhận'}</p><p>✓ Cam kết lâu dài: ${x.long_term_confirmed?'Đã xác nhận':'Chưa xác nhận'}</p><p>✓ Kỷ luật: ${x.discipline_confirmed?'Đã xác nhận':'Chưa xác nhận'}</p><p>✓ Quyền & trách nhiệm: ${x.rights_confirmed?'Đã xác nhận':'Chưa xác nhận'}</p><p>✓ Xác nhận cuối: ${x.final_confirmed?'Đã xác nhận':'Chưa xác nhận'}</p></div>`;
  const actions=document.querySelector('#modalActions');
  actions.innerHTML=`<a class="button-link" href="agreement.html?code=${encodeURIComponent(x.agreement_code)}" target="_blank">XEM BẢN ĐIỆN TỬ</a><button class="danger" data-status="rejected">HỦY HỒ SƠ</button><button class="secondary" data-status="locked">KHÓA HỒ SƠ</button>${x.status!=='approved'?'<button class="secondary" data-status="approved">ĐÁNH DẤU ĐÃ XÁC NHẬN</button>':''}`;
  actions.querySelectorAll('[data-status]').forEach(btn=>btn.addEventListener('click',()=>updateStatus(btn.dataset.status)));modal.hidden=false;
}
async function updateStatus(status){
  if(!activeApplication)return;const {data:{user}}=await sb.auth.getUser();
  const payload={status,updated_at:new Date().toISOString(),reviewed_at:new Date().toISOString(),reviewed_by:user?.id||null};if(status==='locked')payload.locked_at=new Date().toISOString();
  const {error}=await sb.from('merger_applications').update(payload).eq('id',activeApplication.id);if(error){alert(error.message);return;}closeModal();await loadApplications();
}

syncUI();
