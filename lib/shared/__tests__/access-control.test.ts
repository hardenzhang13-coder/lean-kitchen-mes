import { canAccessApi, canAccessPage } from "../access-control";

describe("access control", () => {
  it("allows operations to write master data but not schedules", () => {
    expect(canAccessApi("/api/dishes", "POST", "业务运营")).toBe(true);
    expect(canAccessApi("/api/schedules", "POST", "业务运营")).toBe(false);
  });

  it("allows chefs to manage schedules but not master data", () => {
    expect(canAccessApi("/api/schedules", "POST", "厨师长")).toBe(true);
    expect(canAccessApi("/api/ingredients", "POST", "厨师长")).toBe(false);
    expect(canAccessApi("/api/ingredients", "GET", "厨师长")).toBe(true);
  });

  it("restricts user and settings pages to the expected roles", () => {
    expect(canAccessPage("/settings/users", "业务运营")).toBe(false);
    expect(canAccessPage("/settings", "业务运营")).toBe(true);
    expect(canAccessPage("/settings/profile", "厨师长")).toBe(true);
    expect(canAccessPage("/schedules", "厨师长")).toBe(true);
    expect(canAccessPage("/schedules", "业务运营")).toBe(false);
  });
});
