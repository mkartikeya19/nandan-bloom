import { describe, it, expect } from "vitest";
import {
  canAttemptDelete,
  canDeactivate,
  canRemoveSuperAdmin,
  countActiveSuperAdmins,
  type LifecycleUser,
} from "../user-lifecycle";

const sa = (id: string, isActive = true): LifecycleUser => ({
  id,
  isActive,
  roles: ["super_admin"],
});
const staff = (id: string, isActive = true): LifecycleUser => ({ id, isActive, roles: ["staff"] });

describe("user lifecycle guards", () => {
  it("counts only active super admins", () => {
    expect(countActiveSuperAdmins([sa("a"), sa("b", false), staff("c")])).toBe(1);
  });

  it("refuses self-deactivation", () => {
    expect(canDeactivate(staff("me"), "me", 2)).toBe(false);
  });

  it("refuses deactivating the last active super admin", () => {
    expect(canDeactivate(sa("a"), "me", 1)).toBe(false);
    expect(canDeactivate(sa("a"), "me", 2)).toBe(true);
  });

  it("allows deactivating ordinary staff", () => {
    expect(canDeactivate(staff("a"), "me", 1)).toBe(true);
  });

  it("is a no-op for an already deactivated user", () => {
    expect(canDeactivate(staff("a", false), "me", 2)).toBe(false);
  });

  it("refuses removing your own super admin role", () => {
    expect(canRemoveSuperAdmin(sa("me"), "me", 5)).toBe(false);
  });

  it("refuses removing the last super admin role", () => {
    expect(canRemoveSuperAdmin(sa("a"), "me", 1)).toBe(false);
    expect(canRemoveSuperAdmin(sa("a"), "me", 2)).toBe(true);
  });

  it("does not restrict non super admin roles", () => {
    expect(canRemoveSuperAdmin(staff("a"), "me", 1)).toBe(true);
  });

  it("refuses self-deletion", () => {
    expect(canAttemptDelete(staff("me"), "me")).toBe(false);
    expect(canAttemptDelete(staff("other"), "me")).toBe(true);
  });
});
