import test from "node:test";
import assert from "node:assert/strict";
import "./competition-utils.js";

const {
  formatFeeLabel,
  validateCompetitionPayment,
  buildRegistrationPayload,
  parseRegistrationPayment,
  buildVerificationUpdate,
  isMissingColumnError,
} = globalThis.SYDFCompetition;

test("formatFeeLabel renders Free or formatted Rs.", () => {
  assert.equal(formatFeeLabel(0), "Free");
  assert.equal(formatFeeLabel("0"), "Free");
  assert.equal(formatFeeLabel(300), "Rs. 300");
});

test("validateCompetitionPayment enforces Trx ID for digital methods and allows optional for Cash", () => {
  const freeRes = validateCompetitionPayment({
    regFee: 0,
    paymentMethod: "",
    transactionId: "",
  });
  assert.equal(freeRes.valid, true);
  assert.equal(freeRes.method, "Free");

  const missingMethod = validateCompetitionPayment({
    regFee: 200,
    paymentMethod: "",
    transactionId: "TID12345",
  });
  assert.equal(missingMethod.valid, false);

  const shortTrx = validateCompetitionPayment({
    regFee: 200,
    paymentMethod: "JazzCash",
    transactionId: "12",
  });
  assert.equal(shortTrx.valid, false);

  const validDigital = validateCompetitionPayment({
    regFee: 200,
    paymentMethod: "EasyPaisa",
    transactionId: "EP99887766",
  });
  assert.equal(validDigital.valid, true);
  assert.equal(validDigital.method, "EasyPaisa");
  assert.equal(validDigital.transactionId, "EP99887766");

  const cashDefault = validateCompetitionPayment({
    regFee: 200,
    paymentMethod: "Cash",
    transactionId: "",
  });
  assert.equal(cashDefault.valid, true);
  assert.equal(cashDefault.method, "Cash");
  assert.equal(cashDefault.transactionId, "CASH");

  const cashWithNote = validateCompetitionPayment({
    regFee: 200,
    paymentMethod: "Cash",
    transactionId: "RCP-104",
  });
  assert.equal(cashWithNote.valid, true);
  assert.equal(cashWithNote.transactionId, "RCP-104");
});

test("buildRegistrationPayload creates Pending paid records and Approved free records with fallback", () => {
  const { fullPayload, fallbackPayload } = buildRegistrationPayload({
    comp: { id: 7, reg_fee: 300 },
    formValues: {
      fullName: "Ahmad Khan",
      fatherName: "Zaman Khan",
      schoolName: "GHS Mingora",
      classGrade: "10th",
      contact: "03001234567",
      city: "Swat",
    },
    rollNo: "SYDF-SCH-1234",
    payment: { method: "JazzCash", transactionId: "TID778899" },
  });

  assert.equal(fullPayload.status, "Pending");
  assert.equal(fullPayload.payment_status, "Pending");
  assert.equal(fullPayload.payment_method, "JazzCash");
  assert.equal(fullPayload.transaction_id, "TID778899");
  assert.equal(fallbackPayload.status, "Pending | JazzCash | Trx: TID778899");
});

test("parseRegistrationPayment and buildVerificationUpdate handle native columns and fallback encoding", () => {
  const nativeRow = {
    status: "Pending",
    payment_method: "Bank Transfer",
    transaction_id: "HBL-5511",
    payment_status: "Pending",
  };
  assert.deepEqual(parseRegistrationPayment(nativeRow), {
    status: "Pending",
    paymentStatus: "Pending",
    method: "Bank Transfer",
    transactionId: "HBL-5511",
    encodedInStatus: false,
  });

  const encodedRow = {
    status: "Pending | Cash | Trx: CASH",
  };
  assert.deepEqual(parseRegistrationPayment(encodedRow), {
    status: "Pending",
    paymentStatus: "Pending",
    method: "Cash",
    transactionId: "CASH",
    encodedInStatus: true,
  });

  const upd = buildVerificationUpdate(encodedRow, "Approved");
  assert.deepEqual(upd.fullUpdate, { status: "Approved", payment_status: "Verified" });
  assert.deepEqual(upd.fallbackUpdate, { status: "Approved | Cash | Trx: CASH" });

  assert.equal(
    isMissingColumnError({ code: "PGRST204", message: "Could not find the 'transaction_id' column" }),
    true,
  );
});
