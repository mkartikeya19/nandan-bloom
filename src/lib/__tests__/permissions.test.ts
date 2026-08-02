import { describe, expect, it } from "vitest";
import { buildPermissions } from "@/lib/permissions";
import { formatDate, formatISODate, formatMonthYear, todayISO } from "@/lib/date";

describe("permission service", () => {
  it("gives Super Admin everything", () => {
    const p = buildPermissions(["super_admin"]);
    expect(p.isAdmin).toBe(true);
    expect(p.canEditSettings).toBe(true);
    expect(p.canManageTeachers).toBe(true);
    expect(p.canVoidReceipt).toBe(true);
  });

  it("lets Reception admit and collect but not edit or void", () => {
    const p = buildPermissions(["reception"]);
    expect(p.canCreateStudent).toBe(true);
    expect(p.canCollectFee).toBe(true);
    expect(p.canEditStudent).toBe(false);
    expect(p.canVoidReceipt).toBe(false);
    expect(p.canEditSettings).toBe(false);
  });

  it("lets Principal promote and approve concessions only", () => {
    const p = buildPermissions(["principal"]);
    expect(p.canPromoteStudent).toBe(true);
    expect(p.canApproveConcession).toBe(true);
    expect(p.canManageFeeStructures).toBe(false);
    expect(p.canManageTeachers).toBe(false);
  });

  it("grants nothing without a role and ignores unknown roles", () => {
    const p = buildPermissions(["nonsense", null as unknown as string]);
    expect(p.roles).toEqual([]);
    expect(p.canViewFees).toBe(false);
    expect(p.canCreateStudent).toBe(false);
  });

  it("restricts teacher records to Super Admin", () => {
    expect(buildPermissions(["admin"]).canViewTeachers).toBe(false);
    expect(buildPermissions(["super_admin"]).canViewTeachers).toBe(true);
  });
});

describe("date formatting", () => {
  it("uses the house format", () => {
    expect(formatDate("2026-08-02")).toBe("02 Aug 2026");
    expect(formatMonthYear("2026-08-02")).toBe("Aug 2026");
    expect(formatISODate(new Date("2026-08-02T10:00:00Z"))).toBe("2026-08-02");
  });

  it("falls back for empty and invalid values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
    expect(formatISODate(null)).toBe("");
  });

  it("returns an ISO string for today", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
