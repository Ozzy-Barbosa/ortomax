import { whatsappUrl, clinicNow, allowedHours, appointmentMessage, nextAppointmentDate } from './appointment.js';
document.documentElement.classList.add('js');
const $ = id => document.getElementById(id);
const menu = $('mainNav');
const toggle = $('menuToggle');
function setMenu(open) {
  menu.classList.toggle('open',open);
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open ? 'Cerrar menú' : 'Abrir menú');
}
toggle.addEventListener('click',()=>setMenu(!menu.classList.contains('open')));
menu.addEventListener('click',event=>{ if(event.target.closest('a')) setMenu(false); });
document.addEventListener('click',event=>{ if(!event.target.closest('.nav-wrap')) setMenu(false); });
document.addEventListener('keydown',event=>{ if(event.key==='Escape' && menu.classList.contains('open')) { setMenu(false); toggle.focus(); } });
matchMedia('(min-width:981px)').addEventListener('change',()=>setMenu(false));
const modal = $('appointmentModal');
const date = $('appointmentDate');
const time = $('appointmentTime');
const name = $('patientName');
const options = [...time.options].slice(1);
options.forEach((option,index)=>option.dataset.hour=index+9);
function updateAvailability() {
  date.min=clinicNow().date;
  const available=allowedHours(date.value);
  time.disabled=!available.length;
  time.options[0].textContent = !date.value ? 'Elige primero una fecha' : !available.length ? 'Sin horarios para esta fecha' : 'Selecciona una hora';
  $('appointmentHoursHelp').textContent = !date.value ? 'Selecciona una fecha para consultar las horas.' : !available.length ? 'Elige otro día: no hay horas para solicitar en esta fecha.' : 'Horas para solicitar en la fecha elegida. Tu cita requiere confirmación.';
  options.forEach(option=>{ option.disabled=!available.includes(Number(option.dataset.hour)); option.hidden=option.disabled; });
  if(time.selectedOptions[0]?.disabled) time.value='';
  date.setCustomValidity(date.value && !available.length ? 'Elige una fecha de lunes a sábado con horarios disponibles. Los horarios de hoy que ya pasaron no están disponibles.' : '');
}
date.addEventListener('change',()=>{ time.value=''; updateAvailability(); });
name.addEventListener('input',()=>name.setCustomValidity(name.value.trim() ? '' : 'Escribe tu nombre.'));
function openAppointment(event) {
  event.preventDefault();
  if (!date.value || !allowedHours(date.value).length) date.value=nextAppointmentDate();
  updateAvailability();
  modal.showModal();
  document.body.classList.add('no-scroll');
  name.focus();
}
document.querySelectorAll('a[href="#cita"],#appointmentBtn').forEach(link=>link.addEventListener('click',openAppointment));
$('modalClose').addEventListener('click',()=>modal.close());
const lightbox=$('lightbox');
for(const dialog of [modal,lightbox]) {
  dialog.addEventListener('close',()=>document.body.classList.remove('no-scroll'));
  dialog.addEventListener('click',event=>{
    const box=dialog.getBoundingClientRect();
    if(event.target===dialog && (event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom)) dialog.close();
  });
}
$('appointmentForm').addEventListener('submit',event=>{
  event.preventDefault();
  updateAvailability();
  name.setCustomValidity(name.value.trim() ? '' : 'Escribe tu nombre.');
  if(!event.currentTarget.reportValidity()) return;
  const message=appointmentMessage(name.value,$('patientTreatment').value,date.value,time.value,$('appointmentComments').value);
  // Same-tab navigation avoids popup blockers and retains Back navigation.
  window.location.assign(whatsappUrl(message));
});
$('floatingWa').href=whatsappUrl('Hola Orthomax, me gustaría solicitar información y agendar una cita.');
document.querySelectorAll('.wa-treatment').forEach(link=>{
  link.href=whatsappUrl(`Hola Orthomax, me interesa recibir información sobre ${link.dataset.treatment}. ¿Podrían ayudarme con disponibilidad y precios?`);
  link.setAttribute('aria-label',`Consultar sobre ${link.dataset.treatment} por WhatsApp`);
});
document.querySelectorAll('.gallery-item').forEach(item=>{
  item.setAttribute('aria-label',`Ampliar: ${item.querySelector('img').alt}`);
  item.addEventListener('click',()=>{
    $('lightboxImg').src=item.dataset.full;
    $('lightboxImg').alt=item.querySelector('img').alt;
    $('lightboxCaption').textContent=item.querySelector('img').alt;
    lightbox.showModal();
    document.body.classList.add('no-scroll');
  });
});
$('lightboxClose').addEventListener('click',()=>lightbox.close());
const navLinks=[...menu.querySelectorAll('a:not(.nav-cta)')];
const observer=new IntersectionObserver(entries=>{
  const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
  if(!visible) return;
  for(const link of navLinks) {
    const active=link.hash===`#${visible.target.id}`;
    link.classList.toggle('active',active);
    if(active) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current');
  }
},{rootMargin:'-15% 0px -65% 0px'});
navLinks.forEach(link=>{ const section=document.querySelector(link.hash); if(section) observer.observe(section); });
