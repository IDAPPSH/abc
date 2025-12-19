// /assets/script/main.js
document.addEventListener("DOMContentLoaded", () => {
  // Año footer
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Scroll suave
  function scrollToSection(id) {
    const section = document.getElementById(id);
    if (!section) return;
    const y = section.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  // ✅ CLICK GLOBAL: IGNORA TODO LO QUE SEA CHAT (panel + launcher)
  document.addEventListener("click", function (e) {
    if (e.target.closest("#idappsh-chat-panel") || e.target.closest("#idappsh-chat-launcher")) return;

    const target = e.target.closest("[data-target]");
    if (!target) return;

    const sectionId = target.getAttribute("data-target");
    scrollToSection(sectionId);
  });

  // Menú móvil
  const mobileToggle = document.getElementById("mobileToggle");
  const navMenu = document.getElementById("navMenu");
  const navCta = document.getElementById("navCta");

  if (mobileToggle && navMenu && navCta) {
    mobileToggle.addEventListener("click", () => {
      navMenu.classList.toggle("mobile-open");
      navCta.classList.toggle("mobile-open");
    });

    navMenu.addEventListener("click", (e) => {
      if (e.target.classList.contains("nav-link")) {
        navMenu.classList.remove("mobile-open");
        navCta.classList.remove("mobile-open");
      }
    });
  }

  // Resaltar sección activa
  const sections = document.querySelectorAll("main section");
  const navLinks = document.querySelectorAll(".nav-link");

  function updateActiveNav() {
    let current = "inicio";
    const offset = 120;

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top - offset <= 0) current = section.id;
    });

    navLinks.forEach((link) => {
      const sec = link.getAttribute("data-target");
      link.classList.toggle("active", sec === current);
    });
  }

  window.addEventListener("scroll", updateActiveNav);
  window.addEventListener("load", updateActiveNav);
  updateActiveNav();

  // FAQ
  document.querySelectorAll(".faq-item").forEach((item) => {
    const q = item.querySelector(".faq-question");
    if (!q) return;
    q.addEventListener("click", () => item.classList.toggle("open"));
  });

  // Formulario contacto (demo)
  const contactForm = document.getElementById("contactForm");
  const statusMessage = document.getElementById("statusMessage");

  if (contactForm && statusMessage) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      statusMessage.textContent =
        "Tu mensaje se ha registrado localmente. Cuando conectes el backend se enviará de forma real.";
      statusMessage.classList.add("show", "status-success");
      setTimeout(() => statusMessage.classList.remove("show"), 5000);
      contactForm.reset();
    });
  }

  // Carrusel de imágenes (slides con imagen + texto)
  let imgPosition = 0;

  function moveImgCarousel(direction) {
    const track = document.getElementById("imgCarouselTrack");
    const items = document.querySelectorAll(".img-carousel-slide");
    const total = items.length;
    if (!track || total === 0) return;

    imgPosition += direction;
    if (imgPosition < 0) imgPosition = total - 1;
    if (imgPosition >= total) imgPosition = 0;

    track.style.transform = `translateX(-${imgPosition * 100}%)`;
  }

  setInterval(() => moveImgCarousel(1), 6000);

  // Si tienes botones prev/next en HTML, podrías exponerlo así:
  window.moveImgCarousel = moveImgCarousel;
});
