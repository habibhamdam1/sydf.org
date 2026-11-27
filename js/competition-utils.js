(function (root, factory) {
  const api = factory();
  root.SYDFCompetition = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ALLOWED_METHODS = ["JazzCash", "EasyPaisa", "Bank Transfer", "Cash"];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isPaidCompetition(comp) {
    return Number((comp && comp.reg_fee) || 0) > 0;
  }

  function formatFeeLabel(fee) {
    const amount = Number(fee || 0);
    return amount > 0 ? "Rs. " + amount.toLocaleString("en-PK") : "Free";
  }

  function validateCompetitionPayment({ regFee, paymentMethod, transactionId }) {
    const amount = Number(regFee || 0);
    if (amount <= 0) {
      return { valid: true, method: "Free", transactionId: null };
    }

    const method = String(paymentMethod || "").trim();
    const trx = String(transactionId || "").trim();

    if (!ALLOWED_METHODS.includes(method)) {
      return {
        valid: false,
        error: "Please select a payment method (JazzCash, EasyPaisa, Bank Transfer, or Cash).",
      };
    }

    if (method === "Cash") {
      return {
        valid: true,
        method: "Cash",
        transactionId: trx || "CASH",
      };
    }

    if (trx.length < 4) {
      return {
        valid: false,
        error: "Please enter a valid Transaction ID (at least 4 characters).",
      };
    }

    return {
      valid: true,
      method,
      transactionId: trx,
    };
  }

  function buildRegistrationPayload({ comp, formValues, rollNo, payment }) {
    const paid = isPaidCompetition(comp);
    const base = {
      competition_id: comp.id,
      roll_no: rollNo,
      full_name: String(formValues.fullName || "").trim(),
      father_name: String(formValues.fatherName || "").trim(),
      school_name: String(formValues.schoolName || "").trim() || null,
      class_grade: String(formValues.classGrade || "").trim() || null,
      contact: String(formValues.contact || "").trim(),
      email: String(formValues.email || "").trim() || null,
      cnic_bform: String(formValues.cnic || "").trim() || null,
      city: String(formValues.city || "").trim(),
    };

    const fullPayload = {
      ...base,
      payment_method: paid ? payment.method : "Free",
      transaction_id: paid ? payment.transactionId : null,
      payment_status: paid ? "Pending" : "Verified",
      status: paid ? "Pending" : "Approved",
    };

    const fallbackPayload = {
      ...base,
      status: paid
        ? `Pending | ${payment.method} | Trx: ${payment.transactionId}`
        : "Approved",
    };

    return { fullPayload, fallbackPayload };
  }

  function parseRegistrationPayment(reg) {
    const rawStatus = String((reg && reg.status) || "Pending").trim();
    let status = rawStatus;
    let method = (reg && reg.payment_method) || "";
    let transactionId = (reg && reg.transaction_id) || "";
    let paymentStatus = (reg && reg.payment_status) || "";
    let encodedInStatus = false;

    if (rawStatus.includes("|")) {
      const parts = rawStatus.split("|").map((p) => p.trim());
      status = parts[0] || "Pending";
      if (!method && parts[1]) method = parts[1];
      if (!transactionId && parts[2]) {
        transactionId = parts[2].replace(/^Trx:\s*/i, "").trim();
      }
      encodedInStatus = true;
    }

    const norm = status.toLowerCase();
    if (norm === "approved" || norm === "verified") {
      status = "Approved";
      if (!paymentStatus) paymentStatus = "Verified";
    } else if (norm === "rejected") {
      status = "Rejected";
      if (!paymentStatus) paymentStatus = "Rejected";
    } else {
      status = "Pending";
      if (!paymentStatus) paymentStatus = "Pending";
    }

    return {
      status,
      paymentStatus,
      method: method || (status === "Approved" && !transactionId ? "Free / N/A" : "-"),
      transactionId: transactionId || "-",
      encodedInStatus,
    };
  }

  function buildVerificationUpdate(reg, targetStatus) {
    const parsed = parseRegistrationPayment(reg);
    const nextPayStatus =
      targetStatus === "Approved"
        ? "Verified"
        : targetStatus === "Rejected"
          ? "Rejected"
          : "Pending";

    const fullUpdate = {
      status: targetStatus,
      payment_status: nextPayStatus,
    };

    const hasProofMeta =
      parsed.method && parsed.method !== "-" && parsed.method !== "Free / N/A";

    const fallbackUpdate = {
      status:
        parsed.encodedInStatus && hasProofMeta
          ? `${targetStatus} | ${parsed.method} | Trx: ${parsed.transactionId}`
          : targetStatus,
    };

    return { fullUpdate, fallbackUpdate };
  }

  function isMissingColumnError(error) {
    if (!error) return false;
    const code = String(error.code || "");
    const msg = String(error.message || "").toLowerCase();
    return (
      code === "PGRST204" ||
      code === "42703" ||
      (msg.includes("column") &&
        (msg.includes("does not exist") || msg.includes("could not find")))
    );
  }

  return {
    ALLOWED_METHODS,
    escapeHtml,
    isPaidCompetition,
    formatFeeLabel,
    validateCompetitionPayment,
    buildRegistrationPayload,
    parseRegistrationPayment,
    buildVerificationUpdate,
    isMissingColumnError,
  };
});
