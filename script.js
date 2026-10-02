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
const galleryItems=[...document.querySelectorAll('.gallery-item')];
let galleryIndex=0;
function showGalleryImage(index) {
  galleryIndex=(index+galleryItems.length)%galleryItems.length;
  const item=galleryItems[galleryIndex];
  $('lightboxImg').src=item.dataset.full;
  $('lightboxImg').alt=item.querySelector('img').alt;
  $('lightboxCaption').textContent=item.querySelector('img').alt;
  $('lightboxCount').textContent=`${galleryIndex+1} / ${galleryItems.length}`;
}
galleryItems.forEach((item,index)=>{
  item.setAttribute('aria-label',`Ampliar: ${item.querySelector('img').alt}`);
  item.addEventListener('click',()=>{
    showGalleryImage(index);
    lightbox.showModal();
    document.body.classList.add('no-scroll');
  });
});
$('lightboxClose').addEventListener('click',()=>lightbox.close());
$('lightboxPrevious').addEventListener('click',()=>showGalleryImage(galleryIndex-1));
$('lightboxNext').addEventListener('click',()=>showGalleryImage(galleryIndex+1));
lightbox.addEventListener('keydown',event=>{
  if(event.key==='ArrowLeft' || event.key==='ArrowRight') {
    event.preventDefault();
    showGalleryImage(galleryIndex+(event.key==='ArrowRight'?1:-1));
  }
});
const navLinks=[...menu.querySelectorAll('a:not(.nav-cta)')];
if('IntersectionObserver' in window) {
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
}

// Every treatment stays in the document for reading and crawling without JS.
const explorer=document.querySelector('.treatment-explorer');
const treatmentGrid=$('treatmentResults');
const treatmentCards=[...treatmentGrid.querySelectorAll('[data-category]')];
const filterButtons=[...explorer.querySelectorAll('[data-filter]')];
function filterTreatments(category,animate=true) {
  let count=0;
  filterButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===category)));
  treatmentCards.forEach(card=>{
    card.hidden=category!=='all' && card.dataset.category!==category;
    card.classList.remove('filter-enter');
    if(!card.hidden) {
      count++;
      card.classList.add('is-visible');
      if(animate && !reducedMotion.matches) requestAnimationFrame(()=>card.classList.add('filter-enter'));
    }
  });
  treatmentGrid.classList.toggle('is-filtered',category!=='all');
  $('treatmentStatus').textContent=category==='all'
    ? '5 tratamientos para conocer. Una valoración para elegir.'
    : `${count===1?'1 tratamiento relacionado':`${count} tratamientos relacionados`}. La valoración nos ayuda a decidir contigo.`;
}
filterButtons.forEach(button=>button.addEventListener('click',()=>filterTreatments(button.dataset.filter)));
treatmentCards.forEach(card=>card.addEventListener('animationend',()=>card.classList.remove('filter-enter')));
explorer.hidden=false;
// Anchor links must still work after a visitor filters a service out.
function revealTreatmentAnchor(hash,scroll=false) {
  const target=treatmentCards.find(card=>`#${card.id}`===hash);
  if(!target) return;
  if(target.hidden) filterTreatments('all',false);
  target.classList.add('is-visible');
  if(scroll) requestAnimationFrame(()=>target.scrollIntoView({behavior:'instant',block:'start'}));
}
document.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]');
  if(link) revealTreatmentAnchor(link.hash);
});
addEventListener('hashchange',()=>revealTreatmentAnchor(location.hash,true));

// Progressive motion: the page stays fully readable without JavaScript and
// respects the visitor's reduced-motion preference.
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const motionTargets=[...document.querySelectorAll([
  '.section-intro > *', '.why-copy > *', '.center-heading > *',
  '.visit-heading > *', '.faq-layout > *', '.location-heading > *',
  '.service-card', '.benefit', '.treatment-card', '.visit-steps li',
  '.gallery-item', '.faq-list details', '.location-panel > *', '.why-image', '.visit-link'
].join(','))];

let revealObserver;
function prepareMotion() {
  revealObserver?.disconnect();
  const staggerGroups=document.querySelectorAll('.service-grid,.benefits,.treatment-grid,.visit-steps,.gallery-grid,.faq-list');
  staggerGroups.forEach(group=>{
    [...group.children].forEach((item,index)=>item.style.setProperty('--reveal-delay',`${Math.min(index*75,300)}ms`));
  });

  if(reducedMotion.matches || !('IntersectionObserver' in window)) {
    document.documentElement.classList.remove('motion-ready');
    motionTargets.forEach(target=>target.classList.add('is-visible'));
    return;
  }

  document.documentElement.classList.add('motion-ready');
  motionTargets.forEach(target=>target.classList.add('reveal'));
  revealObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  },{threshold:.08,rootMargin:'0px 0px -24px 0px'});
  motionTargets.forEach(target=>revealObserver.observe(target));
}

prepareMotion();
reducedMotion.addEventListener('change',prepareMotion);
revealTreatmentAnchor(location.hash,true);
requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelector('.hero')?.classList.add('is-ready')));

// A slim reading-progress line and a little more depth for the sticky header.
const header=document.querySelector('.site-header');
const progress=document.createElement('span');
progress.className='site-progress';
progress.setAttribute('aria-hidden','true');
header.append(progress);
let scrollFrame=0;
function updateScrollUi() {
  scrollFrame=0;
  const max=document.documentElement.scrollHeight-innerHeight;
  const ratio=max>0 ? Math.min(scrollY/max,1) : 0;
  progress.style.transform=`scaleX(${ratio})`;
  header.classList.toggle('is-scrolled',scrollY>18);
}
addEventListener('scroll',()=>{
  if(!scrollFrame) scrollFrame=requestAnimationFrame(updateScrollUi);
},{passive:true});
updateScrollUi();

// Pointer-aware light and parallax effects are intentionally subtle and are
// only enabled on precise pointing devices.
const precisePointer=matchMedia('(pointer:fine)');
const heroPhoto=document.querySelector('.hero-photo');
if(!reducedMotion.matches && precisePointer.matches && heroPhoto) {
  heroPhoto.addEventListener('pointermove',event=>{
    if(reducedMotion.matches || !precisePointer.matches) return;
    const box=heroPhoto.getBoundingClientRect();
    heroPhoto.style.setProperty('--media-x',`${((event.clientX-box.left)/box.width-.5)*10}px`);
    heroPhoto.style.setProperty('--media-y',`${((event.clientY-box.top)/box.height-.5)*10}px`);
  });
  heroPhoto.addEventListener('pointerleave',()=>{
    heroPhoto.style.setProperty('--media-x','0px');
    heroPhoto.style.setProperty('--media-y','0px');
  });
}

document.querySelectorAll('.service-card,.treatment-card,.visit-steps li').forEach(card=>{
  card.classList.add('interactive-surface');
  if(reducedMotion.matches || !precisePointer.matches) return;
  card.addEventListener('pointermove',event=>{
    if(reducedMotion.matches || !precisePointer.matches) return;
    const box=card.getBoundingClientRect();
    card.style.setProperty('--glow-x',`${event.clientX-box.left}px`);
    card.style.setProperty('--glow-y',`${event.clientY-box.top}px`);
  });
});

// Animate the full answer height while keeping native details and keyboard access.
const questions=[...document.querySelectorAll('.faq-list details')];
const questionAnimations=new Map();
const questionIsOpen=question=>questionAnimations.get(question)?.open ?? question.open;
function finishQuestion(question) {
  const state=questionAnimations.get(question);
  if(!state) return;
  question.open=state.open;
  state.animation.cancel();
  questionAnimations.delete(question);
  question.classList.remove('is-animating','is-closing');
}
function setQuestionOpen(question,open) {
  if(questionIsOpen(question)===open) return;
  const startHeight=question.getBoundingClientRect().height;
  questionAnimations.get(question)?.animation.cancel();
  questionAnimations.delete(question);
  question.classList.remove('is-animating','is-closing');
  if(reducedMotion.matches || typeof question.animate!=='function') {
    question.open=open;
    return;
  }
  // Keep the content visible until a closing animation has finished.
  question.open=true;
  const summary=question.querySelector('summary');
  const borderHeight=question.offsetHeight-question.clientHeight;
  const endHeight=open ? question.getBoundingClientRect().height : summary.getBoundingClientRect().height+borderHeight;
  question.classList.add('is-animating');
  question.classList.toggle('is-closing',!open);
  const animation=question.animate([{height:`${startHeight}px`},{height:`${endHeight}px`}],{
    duration:420,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'
  });
  questionAnimations.set(question,{animation,open});
  animation.onfinish=()=>{
    if(questionAnimations.get(question)?.animation===animation) finishQuestion(question);
  };
}
questions.forEach(question=>question.querySelector('summary').addEventListener('click',event=>{
  event.preventDefault();
  const open=!questionIsOpen(question);
  if(open) questions.forEach(other=>{ if(other!==question) setQuestionOpen(other,false); });
  setQuestionOpen(question,open);
}));
// Release animated heights immediately if text reflows or reduced motion is enabled.
addEventListener('resize',()=>questionAnimations.forEach((_,question)=>finishQuestion(question)));
reducedMotion.addEventListener('change',()=>{
  if(reducedMotion.matches) questionAnimations.forEach((_,question)=>finishQuestion(question));
});
