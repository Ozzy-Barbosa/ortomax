const PHONE = "526121429561";

function whatsappUrl(message) {
  return `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`;
}

const defaultMessage = "Hola Orthomax, me gustaría solicitar información y agendar una cita.";
document.getElementById("floatingWa").href = whatsappUrl(defaultMessage);

const appointmentDate = document.getElementById("appointmentDate");
const appointmentTime = document.getElementById("appointmentTime");
if (appointmentDate) {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  appointmentDate.min = today.toISOString().split("T")[0];

  appointmentDate.addEventListener("change", () => {
    const selected = new Date(`${appointmentDate.value}T12:00:00`);
    const day = selected.getDay();
    const isSaturday = day === 6;
    const isSunday = day === 0;

    appointmentTime.querySelectorAll("option").forEach(option => {
      if (!option.value) return;
      option.hidden = isSunday || (isSaturday && ["2:00 pm", "3:00 pm", "4:00 pm", "5:00 pm", "6:00 pm"].includes(option.value));
      option.disabled = option.hidden;
    });
    appointmentTime.value = "";
    appointmentDate.setCustomValidity(isSunday ? "Selecciona un día de atención de lunes a sábado." : "");
  });
}

const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

menuToggle.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", open);
  menuToggle.innerHTML = open
    ? '<i class="fa-solid fa-xmark"></i>'
    : '<i class="fa-solid fa-bars"></i>';
});

document.querySelectorAll("#mainNav a").forEach(link => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
  });
});

const appointmentModal = document.getElementById("appointmentModal");
const appointmentBtn = document.getElementById("appointmentBtn");
const modalClose = document.getElementById("modalClose");

function openModal() {
  appointmentModal.classList.add("open");
  appointmentModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
  setTimeout(() => document.getElementById("patientName").focus(), 100);
}

function closeModal() {
  appointmentModal.classList.remove("open");
  appointmentModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
}

document.querySelectorAll('a[href="#cita"]').forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    openModal();
  });
});

appointmentBtn.addEventListener("click", openModal);
modalClose.addEventListener("click", closeModal);

appointmentModal.addEventListener("click", e => {
  if (e.target === appointmentModal) closeModal();
});

document.getElementById("appointmentForm").addEventListener("submit", e => {
  e.preventDefault();

  const name = document.getElementById("patientName").value.trim();
  const treatment = document.getElementById("patientTreatment").value;
  const date = appointmentDate.value;
  const time = appointmentTime.value;
  const extra = document.getElementById("patientMessage").value.trim();
  const preferredDate = new Intl.DateTimeFormat("es-MX", { dateStyle: "full" }).format(new Date(`${date}T12:00:00`));

  let message = `Hola Orthomax, soy ${name}. Me gustaría solicitar una cita.\n\nTratamiento de interés: ${treatment}.\nFecha preferida: ${preferredDate}.\nHora preferida: ${time}.\n\nEntiendo que el horario está sujeto a confirmación.`;
  if (extra) message += `\n\nMensaje: ${extra}`;
  message += "\n\nQuedo atento(a) a su respuesta.";

  window.open(whatsappUrl(message), "_blank", "noopener,noreferrer");
  closeModal();
});

document.querySelectorAll(".wa-treatment").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    const treatment = link.dataset.treatment;
    const message = `Hola Orthomax, me interesa recibir información sobre ${treatment}. ¿Podrían ayudarme con disponibilidad y precios?`;
    window.open(whatsappUrl(message), "_blank", "noopener,noreferrer");
  });
});

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxClose = document.getElementById("lightboxClose");

document.querySelectorAll(".gallery-item").forEach(item => {
  item.addEventListener("click", () => {
    lightboxImg.src = item.dataset.full;
    lightboxImg.alt = item.querySelector("img").alt;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  });
});

function closeLightbox() {
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
  lightboxImg.src = "";
}

lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", e => {
  if (e.target === lightbox) closeLightbox();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeModal();
    closeLightbox();
  }
});

// Marca automáticamente el enlace del menú correspondiente a la sección visible.
const sections = document.querySelectorAll("main section[id]");
const navLinks = document.querySelectorAll('.main-nav a[href^="#"]');

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(link => link.classList.remove("active"));
    const current = document.querySelector(`.main-nav a[href="#${entry.target.id}"]`);
    if (current) current.classList.add("active");
  });
}, { rootMargin: "-30% 0px -60% 0px", threshold: 0 });

sections.forEach(section => observer.observe(section));
