const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".nav-links");

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  navigation.classList.toggle("is-open", !isOpen);
});

navigation.addEventListener("click", (event) => {
  if (event.target.closest("a") || event.target.closest("#auth-open")) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
    navigation.classList.remove("is-open");
  }
});

document.querySelector("#current-year").textContent = new Date().getFullYear();

const siteHeader = document.querySelector(".site-header");
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
document.documentElement.classList.toggle("motion-ready", !motionPreference.matches);
const revealTargets = document.querySelectorAll([
  ".hero-grid > *",
  ".quick-facts .fact",
  ".about-grid > *",
  ".section-heading",
  ".product-card",
  ".services-band > *",
  ".orders-grid > *",
  ".location-grid > *",
  ".faq-item",
  ".gallery-item",
  ".contact-grid > *",
  ".footer-grid > *",
  ".footer-bottom"
].join(", "));

function updateScrollHeader() {
  siteHeader.classList.toggle("is-scrolled", window.scrollY > 12);
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  const scrollProgress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
  siteHeader.style.setProperty("--scroll-progress", `${Math.min(Math.max(scrollProgress, 0), 1) * 100}%`);
}

updateScrollHeader();
window.addEventListener("scroll", updateScrollHeader, { passive: true });

if (!motionPreference.matches && "IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: "0px 0px -40px 0px"
  });

  const staggerGroups = [
    ".quick-facts .fact",
    ".product-card",
    ".faq-item",
    ".gallery-item",
    ".footer-grid > *"
  ];
  staggerGroups.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element, index) => {
      element.style.setProperty("--reveal-delay", `${Math.min(index * 90, 270)}ms`);
    });
  });

  revealTargets.forEach((element) => {
    element.classList.add("js-reveal");
    revealObserver.observe(element);
  });

  motionPreference.addEventListener("change", (event) => {
    if (event.matches) {
      revealObserver.disconnect();
      document.documentElement.classList.remove("motion-ready");
      revealTargets.forEach((element) => {
        element.classList.remove("js-reveal");
        element.classList.add("is-visible");
        element.style.removeProperty("--reveal-delay");
      });
    } else {
      document.documentElement.classList.add("motion-ready");
    }
  });
}

const sectionLinks = [...document.querySelectorAll('.nav-links a[href^="#"], .nav-contact[href^="#"]')];
const trackedSections = sectionLinks
  .map((link) => ({ link, section: document.querySelector(link.getAttribute("href")) }))
  .filter(({ section }) => section);

if ("IntersectionObserver" in window && trackedSections.length) {
  function updateActiveSection() {
    const activeSection = trackedSections
      .map(({ link, section }) => ({ link, section, top: section.getBoundingClientRect().top }))
      .filter(({ section }) => section.getBoundingClientRect().bottom > 100 && section.getBoundingClientRect().top < window.innerHeight * 0.6)
      .sort((first, second) => Math.abs(first.top - 120) - Math.abs(second.top - 120))[0];

    trackedSections.forEach(({ link }) => {
      if (activeSection?.link === link) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  const sectionObserver = new IntersectionObserver(updateActiveSection, {
    rootMargin: "-12% 0px -48% 0px",
    threshold: 0
  });

  trackedSections.forEach(({ section }) => sectionObserver.observe(section));
  let activeSectionFrame = 0;
  window.addEventListener("scroll", () => {
    if (!activeSectionFrame) {
      activeSectionFrame = window.requestAnimationFrame(() => {
        activeSectionFrame = 0;
        updateActiveSection();
      });
    }
  }, { passive: true });
  updateActiveSection();
}

const supabaseUrl = "https://klfetqghfluxhyhsawsr.supabase.co";
const supabasePublishableKey = "sb_publishable_5EaY0JUwPqUrGZzHJ6JrKw_Mpk1QOwG";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabasePublishableKey);
const authDialog = document.querySelector("#auth-dialog");
const authOpen = document.querySelector("#auth-open");
const authOpenLabel = document.querySelector("#auth-open-label");
const authForm = document.querySelector("#auth-form");
const authNameField = document.querySelector("#auth-name-field");
const authEmailField = document.querySelector("#auth-email-field");
const authPasswordField = document.querySelector("#auth-password-field");
const authTabs = document.querySelector("#auth-tabs");
const authStatus = document.querySelector("#auth-status");
const authAccount = document.querySelector("#auth-account");
const authAccountEmail = document.querySelector("#auth-account-email");
const authSubmit = document.querySelector("#auth-submit");
const authEmail = authForm.elements.email;
const authPassword = authForm.elements.password;
const authResendConfirmation = document.querySelector("#auth-resend-confirmation");
let authMode = "signin";
let activeUser = null;
const expiredOtp = new URLSearchParams(window.location.hash.slice(1)).get("error_code") === "otp_expired";

function authRedirectUrl() {
  return `${window.location.origin}/index.html`;
}

function setAuthStatus(message = "", state = "") {
  authStatus.textContent = message;
  authStatus.dataset.state = state;
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === "signup";
  const isRecovery = mode === "reset";
  document.querySelector("#auth-title").textContent = isRecovery
    ? "Set a new password"
    : isSignup ? "Create your account" : "Welcome back";
  document.querySelector("#auth-intro").textContent = isRecovery
    ? "Choose a new password for your Kawaidda account."
    : isSignup
      ? "Create an account to stay connected with Kawaidda."
      : "Sign in to your Kawaidda account to continue.";
  document.querySelector("#auth-signin-tab").setAttribute("aria-selected", String(!isSignup));
  document.querySelector("#auth-signup-tab").setAttribute("aria-selected", String(isSignup));
  authNameField.hidden = !isSignup;
  authNameField.querySelector("input").required = isSignup;
  authEmailField.hidden = isRecovery;
  authEmail.required = !isRecovery;
  authPasswordField.hidden = false;
  authPassword.autocomplete = isSignup || isRecovery ? "new-password" : "current-password";
  authPassword.minLength = isSignup || isRecovery ? 8 : 0;
  authPassword.required = true;
  authTabs.hidden = isRecovery;
  authSubmit.textContent = isRecovery ? "Save new password" : isSignup ? "Create account" : "Sign in";
  document.querySelector("#auth-forgot").hidden = isSignup || isRecovery;
  setAuthStatus();
}

function showPasswordRecovery(user) {
  activeUser = user;
  authOpenLabel.textContent = "Account";
  authAccount.hidden = true;
  authForm.hidden = false;
  authTabs.hidden = true;
  document.querySelector("#auth-intro").hidden = false;
  setAuthMode("reset");
  authDialog.showModal();
  authPassword.focus();
}

function updateAuthView(user) {
  activeUser = user;
  authOpenLabel.textContent = user ? "Account" : "Sign in";
  authAccount.hidden = !user;
  authForm.hidden = Boolean(user);
  authTabs.hidden = Boolean(user);
  document.querySelector("#auth-intro").hidden = Boolean(user);
  if (user) {
    document.querySelector("#auth-title").textContent = "Your account";
    authAccountEmail.textContent = user.email || "";
    setAuthStatus();
  } else {
    setAuthMode("signin");
  }
}

authOpen.addEventListener("click", () => {
  authDialog.showModal();
  if (!activeUser) {
    authEmail.focus();
  }
});

document.querySelector("#auth-close").addEventListener("click", () => authDialog.close());
authDialog.addEventListener("click", (event) => {
  if (event.target === authDialog) {
    authDialog.close();
  }
});

document.querySelector("#auth-signin-tab").addEventListener("click", () => setAuthMode("signin"));
document.querySelector("#auth-signup-tab").addEventListener("click", () => setAuthMode("signup"));

document.querySelector("#auth-forgot").addEventListener("click", async () => {
  if (!authEmail.value.trim()) {
    authEmail.focus();
    setAuthStatus("Enter your email address first, then choose forgot password.", "error");
    return;
  }

  const button = document.querySelector("#auth-forgot");
  button.disabled = true;
  setAuthStatus("Sending password reset email…");
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(authEmail.value.trim(), {
      redirectTo: authRedirectUrl()
    });
    if (error) throw error;
    setAuthStatus("If an account exists for that email, a password reset link is on its way.", "success");
  } catch (error) {
    console.error("Could not request a password reset:", error);
    setAuthStatus("We couldn't send a reset link. Please try again shortly.", "error");
  } finally {
    button.disabled = false;
  }
});

authResendConfirmation.addEventListener("click", async () => {
  if (!authEmail.value.trim()) {
    authEmail.focus();
    setAuthStatus("Enter your email address first, then request a new confirmation email.", "error");
    return;
  }

  authResendConfirmation.disabled = true;
  setAuthStatus("Requesting a new confirmation email…");
  try {
    const { error } = await supabaseClient.auth.resend({
      type: "signup",
      email: authEmail.value.trim(),
      options: { emailRedirectTo: authRedirectUrl() }
    });
    if (error) throw error;
    setAuthStatus("If the account needs confirmation, a new email is on its way.", "success");
  } catch (error) {
    console.error("Could not resend the confirmation email:", error);
    setAuthStatus("We couldn't resend the confirmation email. Please try again shortly.", "error");
  } finally {
    authResendConfirmation.disabled = false;
  }
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authForm.reportValidity()) return;

  const email = authEmail.value.trim();
  const password = authPassword.value;
  authSubmit.disabled = true;
  document.querySelector("#auth-forgot").disabled = true;
  setAuthStatus(authMode === "signup"
    ? "Creating your account…"
    : authMode === "reset" ? "Updating your password…" : "Signing you in…");

  try {
    if (authMode === "reset") {
      const { data, error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
      updateAuthView(data.user);
      setAuthStatus("Your password has been updated.", "success");
    } else if (authMode === "signup") {
      const fullName = authNameField.querySelector("input").value.trim();
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: authRedirectUrl()
        }
      });
      if (error) throw error;

      if (data.session) {
        authDialog.close();
        setAuthStatus();
      } else {
        setAuthStatus("Account created. Check your email for a confirmation link before signing in.", "success");
      }
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      authDialog.close();
    }
  } catch (error) {
    console.error("Authentication request failed:", error);
    setAuthStatus(error.message || "We couldn't complete sign in. Please check your details and try again.", "error");
  } finally {
    authSubmit.disabled = false;
    document.querySelector("#auth-forgot").disabled = false;
  }
});

document.querySelector("#auth-signout").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  setAuthStatus("Signing you out…");
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    authDialog.close();
  } catch (error) {
    console.error("Could not sign out:", error);
    setAuthStatus("We couldn't sign you out. Please try again.", "error");
  } finally {
    button.disabled = false;
  }
});

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY" && session?.user) {
    showPasswordRecovery(session.user);
    return;
  }
  updateAuthView(session?.user || null);
  if (event === "INITIAL_SESSION" && expiredOtp) {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    authDialog.showModal();
    authEmail.focus();
    authResendConfirmation.hidden = false;
    setAuthStatus("This email link has expired or was already used. Enter your email to request a new confirmation email, or use “Forgot your password?” if you were resetting your password.", "error");
  }
});

const inquiryForm = document.querySelector("#inquiry-form");
const formStatus = document.querySelector("#form-status");

const orderForm = document.querySelector("#order-form");
const orderStatus = document.querySelector("#order-status");
const orderDateInput = orderForm.elements.namedItem("requested_date");
const orderLookupForm = document.querySelector("#order-lookup-form");
const orderLookupStatus = document.querySelector("#order-lookup-status");
const orderTrackingResult = document.querySelector("#order-tracking-result");
const orderConfirmation = document.querySelector("#order-confirmation");
orderDateInput.min = new Date().toISOString().slice(0, 10);

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createOrderTrackingCode() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  return `KW-${toHex(randomBytes)}`;
}

async function hashOrderTrackingCode(code) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return toHex(new Uint8Array(digest));
}

function publicImageUrl(path) {
  return supabaseClient.storage.from("site-images").getPublicUrl(path).data.publicUrl;
}

function replaceOptions(select, options, placeholder) {
  const fragment = document.createDocumentFragment();
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.disabled = true;
  emptyOption.selected = true;
  emptyOption.textContent = placeholder;
  fragment.append(emptyOption);

  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    fragment.append(option);
  });

  select.replaceChildren(fragment);
}

function renderProducts(products) {
  const productGrid = document.querySelector("#product-grid");
  productGrid.replaceChildren();

  if (!products.length) {
    productGrid.textContent = "Our product list is being updated. Please contact our team for current availability.";
    return;
  }

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";
    const photo = document.createElement("div");
    photo.className = "product-photo";
    const image = document.createElement("img");
    image.src = publicImageUrl(product.image_path);
    image.alt = product.name;
    image.loading = "lazy";
    photo.append(image);

    const info = document.createElement("div");
    info.className = "product-info";
    const title = document.createElement("h3");
    title.textContent = product.name;
    const description = document.createElement("p");
    description.textContent = product.description;
    info.append(title, description);
    card.append(photo, info);
    productGrid.append(card);
  });
}

function renderServices(services) {
  const serviceList = document.querySelector("#service-list");
  serviceList.replaceChildren();
  services.forEach((service) => {
    const item = document.createElement("li");
    item.textContent = service.name;
    serviceList.append(item);
  });
  if (!services.length) {
    const item = document.createElement("li");
    item.textContent = "Please contact our team to ask about available services.";
    serviceList.append(item);
  }
}

function renderGallery(images) {
  const galleryGrid = document.querySelector("#gallery-grid");
  galleryGrid.replaceChildren();

  if (!images.length) {
    galleryGrid.textContent = "New farm photos are coming soon.";
    return;
  }

  images.forEach((galleryImage) => {
    const figure = document.createElement("figure");
    figure.className = "gallery-item";
    const image = document.createElement("img");
    image.src = publicImageUrl(galleryImage.image_path);
    image.alt = galleryImage.alt_text;
    image.loading = "lazy";
    const caption = document.createElement("figcaption");
    caption.textContent = galleryImage.caption;
    figure.append(image, caption);
    galleryGrid.append(figure);
  });
}

async function loadPublicContent() {
  const productsStatus = document.querySelector("#products-status");
  const galleryStatus = document.querySelector("#gallery-status");
  const orderSubmitButton = orderForm.querySelector('button[type="submit"]');
  orderStatus.dataset.state = "";
  orderStatus.textContent = "Loading current products and services…";
  const [productsResult, servicesResult, galleryResult] = await Promise.all([
    supabaseClient.from("products").select("slug,name,description,image_path,sort_order").eq("is_active", true).order("sort_order").order("name"),
    supabaseClient.from("services").select("slug,name,sort_order").eq("is_active", true).order("sort_order").order("name"),
    supabaseClient.from("gallery_images").select("image_path,alt_text,caption,sort_order").eq("is_active", true).order("sort_order").order("created_at")
  ]);

  if (productsResult.error) {
    console.error("Could not load public products:", productsResult.error);
    productsStatus.textContent = "Live products could not be loaded. The examples shown may be out of date.";
  } else {
    renderProducts(productsResult.data);
    productsStatus.textContent = "";
  }

  if (servicesResult.error) {
    console.error("Could not load public services:", servicesResult.error);
  } else {
    renderServices(servicesResult.data);
  }

  if (galleryResult.error) {
    console.error("Could not load the public gallery:", galleryResult.error);
    galleryStatus.textContent = "Live gallery photos could not be loaded.";
  } else {
    renderGallery(galleryResult.data);
    galleryStatus.textContent = "";
  }

  if (!productsResult.error && !servicesResult.error) {
    const productAndServiceNames = [...new Set([
      ...productsResult.data.map((product) => product.name),
      ...servicesResult.data.map((service) => service.name)
    ])];
    const orderProductSelect = orderForm.elements.product;
    replaceOptions(orderProductSelect, productAndServiceNames, "Choose what you need");
    replaceOptions(inquiryForm.elements.interest, [...productAndServiceNames, "Other"], "Select a service");
    if (productAndServiceNames.length) {
      orderProductSelect.disabled = false;
      orderSubmitButton.disabled = false;
      orderStatus.textContent = "";
    } else {
      orderStatus.dataset.state = "warning";
      orderStatus.textContent = "Order requests are temporarily unavailable. Please call or WhatsApp our team.";
    }
  } else {
    orderStatus.dataset.state = "error";
    orderStatus.textContent = "We couldn't load current order options. Please call or WhatsApp our team.";
  }
}

loadPublicContent().catch((error) => {
  console.error("Could not load public website content:", error);
  document.querySelector("#products-status").textContent = "Live products could not be loaded. The examples shown may be out of date.";
  document.querySelector("#gallery-status").textContent = "Live gallery photos could not be loaded.";
});

inquiryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(inquiryForm);

  if (formData.get("company_website")) {
    return;
  }

  const submitButton = inquiryForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  formStatus.dataset.state = "";
  formStatus.textContent = "Sending your inquiry…";

  const inquiry = {
    name: formData.get("name").trim(),
    phone: formData.get("phone").trim(),
    email: formData.get("email").trim() || null,
    interest: formData.get("interest"),
    message: formData.get("message").trim()
  };

  try {
    const { error: inquiryError } = await supabaseClient.from("inquiries").insert(inquiry);
    if (inquiryError) {
      throw inquiryError;
    }

    inquiryForm.reset();
    try {
      const { error: notificationError } = await supabaseClient.functions.invoke("notify-whatsapp-inquiry", {
        body: { inquiry }
      });
      if (notificationError) {
        throw notificationError;
      }

      formStatus.dataset.state = "success";
      formStatus.textContent = "Thank you. Your inquiry has been sent and our team has been notified.";
    } catch (error) {
      console.error("Inquiry was saved, but the WhatsApp team notification failed:", error);
      formStatus.dataset.state = "warning";
      formStatus.textContent = "Your inquiry was saved, but we couldn't notify our team on WhatsApp. Please call or WhatsApp us directly.";
    }
  } catch (error) {
    console.error("Could not submit the inquiry to Supabase:", error);
    formStatus.dataset.state = "error";
    formStatus.textContent = "We couldn't send your inquiry. Please call or WhatsApp us instead.";
  } finally {
    submitButton.disabled = false;
  }
});

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!orderForm.reportValidity()) return;

  const formData = new FormData(orderForm);
  if (formData.get("company_website")) return;

  const submitButton = orderForm.querySelector('button[type="submit"]');
  const request = {
    name: String(formData.get("name") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    email: String(formData.get("email") || "").trim() || null,
    product: String(formData.get("product") || ""),
    quantity: String(formData.get("quantity") || "").trim(),
    requested_date: String(formData.get("requested_date") || "") || null,
    notes: String(formData.get("notes") || "").trim() || null
  };
  let trackingCode = "";

  submitButton.disabled = true;
  orderStatus.dataset.state = "";
  orderStatus.textContent = "Sending your order request…";

  try {
    trackingCode = createOrderTrackingCode();
    request.tracking_hash = await hashOrderTrackingCode(trackingCode);
    const { error } = await supabaseClient.from("order_requests").insert(request);
    if (error) throw error;

    orderForm.reset();
    orderDateInput.min = new Date().toISOString().slice(0, 10);
    document.querySelector("#order-confirmation-code").textContent = trackingCode;
    orderConfirmation.hidden = false;
    orderConfirmation.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const messageParts = [
      `Order request for ${request.quantity}.`,
      request.requested_date ? `Requested date: ${request.requested_date}.` : "",
      request.notes ? `Details: ${request.notes}` : ""
    ].filter(Boolean);
    try {
      const { error: notificationError } = await supabaseClient.functions.invoke("notify-whatsapp-inquiry", {
        body: {
          inquiry: {
            name: request.name,
            phone: request.phone,
            email: request.email,
            interest: request.product,
            message: messageParts.join(" ")
          }
        }
      });

      orderLookupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!orderLookupForm.reportValidity()) return;

        const input = orderLookupForm.elements.tracking_code;
        const trackingCode = `KW-${input.value.trim().slice(3).toLowerCase()}`;
        const button = orderLookupForm.querySelector('button[type="submit"]');
        button.disabled = true;
        orderLookupStatus.dataset.state = "";
        orderLookupStatus.textContent = "Checking your order…";
        orderTrackingResult.hidden = true;

        try {
          const trackingHash = await hashOrderTrackingCode(trackingCode);
          const { data, error } = await supabaseClient.rpc("lookup_order_status", {
            p_tracking_hash: trackingHash
          });
          if (error) throw error;
          if (!data.length) {
            orderLookupStatus.dataset.state = "error";
            orderLookupStatus.textContent = "We couldn't find an order for that code. Check the code and try again.";
            return;
          }

          const order = data[0];
          const statusLabels = {
            pending: "Pending — awaiting availability and price confirmation",
            confirmed: "Confirmed",
            processing: "Processing",
            completed: "Completed",
            cancelled: "Cancelled"
          };
          const heading = document.createElement("h4");
          heading.textContent = "Order request status";
          const details = document.createElement("dl");
          details.className = "order-tracking-details";
          [
            ["Product or service", order.product],
            ["Quantity", order.quantity],
            ["Requested date", order.requested_date || "Not specified"],
            ["Status", statusLabels[order.order_status] || "Pending"],
            ["Request date", new Date(order.created_at).toLocaleDateString()]
          ].forEach(([labelText, value]) => {
            const wrapper = document.createElement("div");
            const label = document.createElement("dt");
            label.textContent = labelText;
            const description = document.createElement("dd");
            description.textContent = value;
            wrapper.append(label, description);
            details.append(wrapper);
          });
          orderTrackingResult.replaceChildren(heading, details);
          orderTrackingResult.hidden = false;
          orderLookupStatus.textContent = "";
        } catch (error) {
          console.error("Could not look up order status:", error);
          orderLookupStatus.dataset.state = "error";
          orderLookupStatus.textContent = "We couldn't check the order status right now. Please try again shortly.";
        } finally {
          button.disabled = false;
        }
      });

      document.querySelector("#copy-order-tracking-code").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const code = document.querySelector("#order-confirmation-code").textContent;
        try {
          await navigator.clipboard.writeText(code);
          button.textContent = "Copied";
        } catch (error) {
          console.error("Could not copy the order tracking code:", error);
          button.textContent = "Copy unavailable";
        }
      });

      if (notificationError) throw notificationError;
      orderStatus.dataset.state = "success";
      orderStatus.textContent = "Your request is pending. Our team has been notified and will contact you to confirm availability, pricing, and next steps.";
    } catch (error) {
      console.error("Order request was saved, but the WhatsApp team notification failed:", error);
      orderStatus.dataset.state = "warning";
      orderStatus.textContent = "Your request was saved as pending, but our team could not be notified automatically. Please call or WhatsApp us to follow up.";
    }
  } catch (error) {
    console.error("Could not submit the order request to Supabase:", error);
    orderStatus.dataset.state = "error";
    orderStatus.textContent = "We couldn't send your request. Please call or WhatsApp us instead.";
  } finally {
    submitButton.disabled = false;
  }
});
