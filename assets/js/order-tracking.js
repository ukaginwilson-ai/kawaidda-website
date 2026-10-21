const supabaseUrl = "https://klfetqghfluxhyhsawsr.supabase.co";
const supabasePublishableKey = "sb_publishable_5EaY0JUwPqUrGZzHJ6JrKw_Mpk1QOwG";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabasePublishableKey);
const orderLookupForm = document.querySelector("#order-lookup-form");
const orderLookupStatus = document.querySelector("#order-lookup-status");
const orderTrackingResult = document.querySelector("#order-tracking-result");
const trackingCodeInput = orderLookupForm.elements.tracking_code;

trackingCodeInput.addEventListener("input", () => {
  trackingCodeInput.value = trackingCodeInput.value.toUpperCase();
});

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashOrderTrackingCode(code) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return toHex(new Uint8Array(digest));
}

function renderOrderStatus(order) {
  const statusLabels = {
    pending: "Pending — awaiting availability and price confirmation",
    confirmed: "Confirmed",
    processing: "Processing",
    completed: "Completed",
    cancelled: "Cancelled"
  };
  const heading = document.createElement("h2");
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
}

orderLookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!orderLookupForm.reportValidity()) return;

  const trackingCode = `KW-${trackingCodeInput.value.trim().slice(3).toLowerCase()}`;
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

    renderOrderStatus(data[0]);
    orderLookupStatus.textContent = "";
  } catch (error) {
    console.error("Could not look up order status:", error);
    orderLookupStatus.dataset.state = "error";
    orderLookupStatus.textContent = "We couldn't check the order status right now. Please try again shortly.";
  } finally {
    button.disabled = false;
  }
});
