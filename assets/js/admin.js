const supabaseUrl = "https://klfetqghfluxhyhsawsr.supabase.co";
const supabasePublishableKey = "sb_publishable_5EaY0JUwPqUrGZzHJ6JrKw_Mpk1QOwG";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabasePublishableKey);

const signInPanel = document.querySelector("#sign-in-panel");
const accessDeniedPanel = document.querySelector("#access-denied-panel");
const dashboard = document.querySelector("#dashboard");
const signInForm = document.querySelector("#sign-in-form");
const signInStatus = document.querySelector("#sign-in-status");
const dashboardStatus = document.querySelector("#dashboard-status");
const contentSchemas = {
  products: [
    { name: "slug", label: "URL slug", type: "text", maxLength: 120 },
    { name: "name", label: "Product name", type: "text", required: true, maxLength: 120 },
    { name: "description", label: "Description", type: "textarea", required: true, maxLength: 1000 },
    { name: "image_path", label: "Image path", type: "text", required: true, maxLength: 500 },
    { name: "sort_order", label: "Display order", type: "number", required: true },
    { name: "is_active", label: "Show on public website", type: "checkbox" }
  ],
  services: [
    { name: "slug", label: "URL slug", type: "text", maxLength: 120 },
    { name: "name", label: "Service name", type: "text", required: true, maxLength: 120 },
    { name: "sort_order", label: "Display order", type: "number", required: true },
    { name: "is_active", label: "Show on public website", type: "checkbox" }
  ],
  gallery_images: [
    { name: "image_path", label: "Image path", type: "text", required: true, maxLength: 500 },
    { name: "alt_text", label: "Image description (alt text)", type: "text", required: true, maxLength: 250 },
    { name: "caption", label: "Caption", type: "text", required: true, maxLength: 120 },
    { name: "sort_order", label: "Display order", type: "number", required: true },
    { name: "is_active", label: "Show on public website", type: "checkbox" }
  ]
};
const contentColumns = {
  products: ["name", "slug", "description", "image_path", "sort_order", "is_active"],
  services: ["name", "slug", "sort_order", "is_active"],
  gallery_images: ["caption", "alt_text", "image_path", "sort_order", "is_active"]
};

function setStatus(element, message = "", state = "") {
  element.textContent = message;
  element.dataset.state = state;
}

function showOnly(panel) {
  signInPanel.hidden = panel !== signInPanel;
  accessDeniedPanel.hidden = panel !== accessDeniedPanel;
  dashboard.hidden = panel !== dashboard;
}

function setDashboardStatus(message = "", state = "") {
  setStatus(dashboardStatus, message, state);
}

async function authorizeSession() {
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError) {
    console.error("Could not read the staff session:", sessionError);
    showOnly(signInPanel);
    setStatus(signInStatus, "We couldn't verify your sign-in. Please try again.", "error");
    return;
  }

  const user = sessionData.session?.user;
  if (!user) {
    showOnly(signInPanel);
    return;
  }

  const { data: isAdmin, error: permissionError } = await supabaseClient.rpc("is_site_admin");
  if (permissionError) {
    console.error("Could not verify staff administrator access:", permissionError);
    showOnly(accessDeniedPanel);
    document.querySelector("#access-denied-message").textContent =
      "Administrator access could not be verified. Apply the current supabase-setup.sql in the Supabase SQL Editor, then retry. If setup is already applied, contact the site administrator.";
    return;
  }
  if (!isAdmin) {
    showOnly(accessDeniedPanel);
    document.querySelector("#access-denied-message").textContent =
      "This account is not authorized to manage the site. Contact the site administrator if you need access.";
    return;
  }

  showOnly(dashboard);
  document.querySelector("#signed-in-email").textContent = user.email || "";
  setStatus(signInStatus);
  await loadView("inquiries");
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error("Could not sign out of the staff dashboard:", error);
    const message = "We couldn't sign you out. Please try again.";
    if (dashboard.hidden) {
      document.querySelector("#access-denied-message").textContent = message;
    } else {
      setDashboardStatus(message, "error");
    }
    return;
  }
  setStatus(signInStatus);
  showOnly(signInPanel);
}

signInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!signInForm.reportValidity()) return;
  const email = signInForm.elements.email.value.trim();
  const password = signInForm.elements.password.value;
  signInForm.querySelector('button[type="submit"]').disabled = true;
  setStatus(signInStatus, "Signing in…");
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    signInForm.reset();
    await authorizeSession();
  } catch (error) {
    console.error("Staff sign-in failed:", error);
    setStatus(signInStatus, "We couldn't sign you in. Check your details and try again.", "error");
  } finally {
    signInForm.querySelector('button[type="submit"]').disabled = false;
  }
});

document.querySelector("#sign-out").addEventListener("click", signOut);
document.querySelector("#denied-sign-out").addEventListener("click", signOut);

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Active" : "Hidden";
  return String(value);
}

function addCell(row, value, className = "") {
  const cell = document.createElement("td");
  cell.textContent = formatValue(value);
  if (className) cell.className = className;
  row.append(cell);
  return cell;
}

function makeTable(headers) {
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((header) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = header.replaceAll("_", " ");
    headRow.append(cell);
  });
  head.append(headRow);
  table.append(head, document.createElement("tbody"));
  return table;
}

async function loadSubmissions(tableName) {
  const container = document.querySelector(`#${tableName}-records`);
  container.textContent = "Loading…";
  const { data, error } = await supabaseClient.from(tableName).select("*").order("created_at", { ascending: false });
  if (error) {
    console.error(`Could not load ${tableName}:`, error);
    container.textContent = "These records could not be loaded. Please try again.";
    return;
  }
  if (!data.length) {
    container.textContent = "No records yet.";
    return;
  }

  const isOrderRequest = tableName === "order_requests";
  const fields = !isOrderRequest
    ? ["created_at", "name", "phone", "email", "interest", "message", "status"]
    : ["created_at", "name", "phone", "email", "product", "quantity", "requested_date", "notes", "order_status"];
  const table = makeTable([...fields, isOrderRequest ? "Manage" : "Update status"]);
  const body = table.querySelector("tbody");
  data.forEach((record) => {
    const row = document.createElement("tr");
    fields.forEach((field) => {
      let value = record[field];
      if (field === "created_at" && value) value = new Date(value).toLocaleString();
      addCell(row, value, ["message", "notes"].includes(field) ? "admin-message" : "");
    });
    const actionCell = document.createElement("td");
    if (isOrderRequest) {
      const statusSelect = document.createElement("select");
      statusSelect.setAttribute("aria-label", `Update order status for ${record.name}`);
      ["pending", "confirmed", "processing", "completed", "cancelled"].forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status[0].toUpperCase() + status.slice(1);
        option.selected = (record.order_status || "pending") === status;
        statusSelect.append(option);
      });
      statusSelect.addEventListener("change", async () => {
        const previousStatus = record.order_status || "pending";
        statusSelect.disabled = true;
        try {
          const { error: updateError } = await supabaseClient.from(tableName)
            .update({ order_status: statusSelect.value })
            .eq("id", record.id);
          if (updateError) throw updateError;
          record.order_status = statusSelect.value;
          setDashboardStatus("Order tracking status updated.", "success");
          await loadSubmissions(tableName);
        } catch (updateError) {
          console.error("Could not update order tracking status:", updateError);
          setDashboardStatus("The order tracking status could not be updated.", "error");
          statusSelect.value = previousStatus;
          statusSelect.disabled = false;
        }
      });
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit details";
      editButton.addEventListener("click", () => openOrderEditor(record));
      actionCell.className = "admin-actions";
      actionCell.append(statusSelect, editButton);
    } else {
      const statusSelect = document.createElement("select");
      statusSelect.setAttribute("aria-label", `Update status for ${record.name}`);
      ["new", "contacted", "closed"].forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status[0].toUpperCase() + status.slice(1);
        option.selected = record.status === status;
        statusSelect.append(option);
      });
      statusSelect.addEventListener("change", async () => {
        statusSelect.disabled = true;
        const { error: updateError } = await supabaseClient.from(tableName)
          .update({ status: statusSelect.value })
          .eq("id", record.id);
        if (updateError) {
          console.error(`Could not update ${tableName} status:`, updateError);
          setDashboardStatus("The record status could not be updated.", "error");
          statusSelect.value = record.status;
        } else {
          record.status = statusSelect.value;
          setDashboardStatus("Record status updated.", "success");
        }
        statusSelect.disabled = false;
      });
      actionCell.append(statusSelect);
    }
    row.append(actionCell);
    body.append(row);
  });
  container.replaceChildren(table);
}

const orderRequestEditor = document.querySelector("#order-request-editor");

async function openOrderEditor(order) {
  const form = orderRequestEditor;
  const productSelect = form.elements.product;
  const [productsResult, servicesResult] = await Promise.all([
    supabaseClient.from("products").select("name").eq("is_active", true).order("sort_order"),
    supabaseClient.from("services").select("name").eq("is_active", true).order("sort_order")
  ]);
  if (productsResult.error || servicesResult.error) {
    console.error("Could not load catalog options for the order editor:", productsResult.error || servicesResult.error);
    setDashboardStatus("The order editor could not load the current catalog. Please try again.", "error");
    return;
  }

  const productNames = [...new Set([
    ...productsResult.data.map((item) => item.name),
    ...servicesResult.data.map((item) => item.name),
    order.product
  ])];
  productSelect.replaceChildren(...productNames.map((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    return option;
  }));
  form.elements.id.value = order.id;
  form.elements.name.value = order.name;
  form.elements.phone.value = order.phone;
  form.elements.email.value = order.email || "";
  form.elements.product.value = order.product;
  form.elements.quantity.value = order.quantity;
  form.elements.requested_date.value = order.requested_date || "";
  form.elements.notes.value = order.notes || "";
  form.elements.order_status.value = order.order_status || "pending";
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.querySelector("#cancel-order-edit").addEventListener("click", () => {
  orderRequestEditor.hidden = true;
  orderRequestEditor.reset();
});

orderRequestEditor.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!orderRequestEditor.reportValidity()) return;

  const formData = new FormData(orderRequestEditor);
  const button = orderRequestEditor.querySelector('button[type="submit"]');
  const order = {
    name: String(formData.get("name")).trim(),
    phone: String(formData.get("phone")).trim(),
    email: String(formData.get("email")).trim() || null,
    product: String(formData.get("product")),
    quantity: String(formData.get("quantity")).trim(),
    requested_date: String(formData.get("requested_date")) || null,
    notes: String(formData.get("notes")).trim() || null,
    order_status: String(formData.get("order_status"))
  };

  button.disabled = true;
  setDashboardStatus("Saving order changes…");
  const { error } = await supabaseClient.from("order_requests")
    .update(order)
    .eq("id", String(formData.get("id")));
  button.disabled = false;

  if (error) {
    console.error("Could not update order request:", error);
    setDashboardStatus("Order changes could not be saved. Check the database setup and try again.", "error");
    return;
  }

  orderRequestEditor.hidden = true;
  orderRequestEditor.reset();
  setDashboardStatus("Order request updated.", "success");
  await loadSubmissions("order_requests");
});

function loadContent(tableName) {
  const container = document.querySelector(`#${tableName}-records`);
  container.textContent = "Loading…";
  const columns = contentColumns[tableName];
  const secondaryOrder = tableName === "gallery_images" ? "caption" : "name";
  supabaseClient.from(tableName).select("*").order("sort_order").order(secondaryOrder)
    .then(({ data, error }) => {
      if (error) {
        console.error(`Could not load ${tableName}:`, error);
        container.textContent = "This content could not be loaded. Please try again.";
        return;
      }
      if (!data.length) {
        container.textContent = "There is no content yet. Use the button above to add some.";
        return;
      }

      const table = makeTable([...columns, "Actions"]);
      const body = table.querySelector("tbody");
      data.forEach((record) => {
        const row = document.createElement("tr");
        columns.forEach((column) => addCell(row, record[column], column === "description" ? "admin-message" : ""));
        const actionsCell = document.createElement("td");
        actionsCell.className = "admin-actions";
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.dataset.editId = record.id;
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.dataset.deleteId = record.id;
        actionsCell.append(editButton, deleteButton);
        row.append(actionsCell);
        body.append(row);
      });
      container.replaceChildren(table);
    })
    .catch((error) => {
      console.error(`Could not load ${tableName}:`, error);
      container.textContent = "This content could not be loaded. Please try again.";
    });
}

async function loadView(view) {
  setDashboardStatus();
  document.querySelectorAll(".admin-tabs [data-view]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.view === view));
  });
  document.querySelectorAll(".admin-panel").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== view;
  });
  if (view === "inquiries" || view === "order_requests") {
    await loadSubmissions(view);
  } else {
    loadContent(view);
  }
}

document.querySelector(".admin-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (button) loadView(button.dataset.view);
});

function fieldControl(field, value) {
  const label = document.createElement("label");
  label.textContent = field.label;
  const input = document.createElement(field.type === "textarea" ? "textarea" : "input");
  input.name = field.name;
  if (field.type !== "textarea") input.type = field.type;
  if (field.maxLength) input.maxLength = field.maxLength;
  if (field.type === "number") {
    input.min = "0";
    input.step = "1";
  }
  if (field.required) input.required = true;
  if (field.type === "checkbox") {
    label.className = "admin-checkbox";
    input.checked = Boolean(value);
    label.prepend(input);
    return label;
  }
  if (value !== undefined && value !== null) input.value = String(value);
  label.append(input);
  return label;
}

function openEditor(tableName, record = {}) {
  const editor = document.querySelector(`#${tableName}-editor`);
  const title = document.createElement("h3");
  title.textContent = record.id ? "Edit content" : "Add content";
  const schema = contentSchemas[tableName];
  const controls = schema.map((field) => fieldControl(field, record[field.name]));

  editor.replaceChildren(title);
  if (record.id) {
    const id = document.createElement("input");
    id.type = "hidden";
    id.name = "id";
    id.value = record.id;
    editor.append(id);
  }
  controls.forEach((control) => editor.append(control));

  if (tableName === "products" || tableName === "gallery_images") {
    const uploadLabel = document.createElement("label");
    uploadLabel.textContent = "Upload a photo (JPG, PNG, or WebP; up to 10 MB)";
    const uploadInput = document.createElement("input");
    uploadInput.type = "file";
    uploadInput.accept = "image/jpeg,image/png,image/webp";
    uploadInput.addEventListener("change", async () => {
      const file = uploadInput.files[0];
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
        setDashboardStatus("Choose a JPG, PNG, or WebP image no larger than 10 MB.", "error");
        uploadInput.value = "";
        return;
      }
      setDashboardStatus("Uploading image…");
      uploadInput.disabled = true;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `uploads/${crypto.randomUUID()}-${safeName}`;
      let error;
      try {
        ({ error } = await supabaseClient.storage.from("site-images").upload(path, file, {
          contentType: file.type,
          upsert: false
        }));
      } catch (uploadError) {
        console.error("Could not upload the website image:", uploadError);
        setDashboardStatus("The image could not be uploaded. Check your connection and try again.", "error");
        uploadInput.disabled = false;
        return;
      }
      uploadInput.disabled = false;
      if (error) {
        console.error("Could not upload the website image:", error);
        setDashboardStatus("The image could not be uploaded. Check your connection and try again.", "error");
        return;
      }
      editor.elements.namedItem("image_path").value = path;
      setDashboardStatus("Image uploaded. Save the form to publish it.", "success");
    });
    uploadLabel.append(uploadInput);
    editor.append(uploadLabel);
  }

  const actions = document.createElement("div");
  actions.className = "admin-editor-actions";
  const save = document.createElement("button");
  save.type = "submit";
  save.className = "button";
  save.textContent = "Save";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => {
    editor.hidden = true;
    editor.reset();
  });
  actions.append(save, cancel);
  editor.append(actions);
  editor.hidden = false;
  editor.scrollIntoView({ behavior: "smooth", block: "nearest" });

  editor.onsubmit = async (event) => {
    event.preventDefault();
    if (!editor.reportValidity()) return;
    const formData = new FormData(editor);
    const item = {};
    schema.forEach((field) => {
      if (field.type === "checkbox") {
        item[field.name] = formData.get(field.name) === "on";
      } else if (field.type === "number") {
        item[field.name] = Number(formData.get(field.name));
      } else {
        item[field.name] = String(formData.get(field.name) || "").trim();
      }
    });
    if (tableName !== "gallery_images" && !item.slug) {
      item.slug = item.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    const recordId = formData.get("id");
    save.disabled = true;
    setDashboardStatus("Saving content…");
    const query = recordId
      ? supabaseClient.from(tableName).update(item).eq("id", recordId)
      : supabaseClient.from(tableName).insert(item);
    const { error } = await query;
    save.disabled = false;
    if (error) {
      console.error(`Could not save ${tableName}:`, error);
      setDashboardStatus("The content could not be saved. Check required fields and try again.", "error");
      return;
    }
    editor.hidden = true;
    editor.reset();
    setDashboardStatus("Content saved.", "success");
    loadContent(tableName);
  };
}

document.querySelectorAll("[data-add-content]").forEach((button) => {
  button.addEventListener("click", () => openEditor(button.dataset.addContent));
});

document.querySelectorAll(".admin-panel[data-panel='products'], .admin-panel[data-panel='services'], .admin-panel[data-panel='gallery_images']")
  .forEach((panel) => {
    panel.addEventListener("click", async (event) => {
      const tableName = panel.dataset.panel;
      const editButton = event.target.closest("[data-edit-id]");
      if (editButton) {
        const { data, error } = await supabaseClient.from(tableName).select("*").eq("id", editButton.dataset.editId).single();
        if (error) {
          console.error(`Could not load ${tableName} item:`, error);
          setDashboardStatus("The item could not be loaded for editing.", "error");
          return;
        }
        openEditor(tableName, data);
        return;
      }
      const deleteButton = event.target.closest("[data-delete-id]");
      if (deleteButton && window.confirm("Delete this content item? This cannot be undone.")) {
        const { error } = await supabaseClient.from(tableName).delete().eq("id", deleteButton.dataset.deleteId);
        if (error) {
          console.error(`Could not delete ${tableName} item:`, error);
          setDashboardStatus("The content item could not be deleted.", "error");
          return;
        }
        setDashboardStatus("Content deleted.", "success");
        loadContent(tableName);
      }
    });
  });

authorizeSession().catch((error) => {
  console.error("Could not initialize the staff dashboard:", error);
  showOnly(signInPanel);
  setStatus(signInStatus, "The dashboard couldn't load. Please refresh and try again.", "error");
});
