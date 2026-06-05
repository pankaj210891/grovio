import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeMailerMock() {
  return {
    sendMail: vi.fn().mockResolvedValue({ messageId: "test-msg-id" }),
  };
}

function makeDbMock() {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "invite-id-1", inviteToken: "uuid-token-123" }]),
  };
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };

  // Transaction mock: calls the callback with tx that has same methods
  const txChain = {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
  };

  const db: Record<string, unknown> = {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    transaction: vi.fn().mockImplementation(async (cb: (tx: typeof txChain) => Promise<unknown>) => {
      return cb(txChain);
    }),
    _selectChain: selectChain,
    _insertChain: insertChain,
    _updateChain: updateChain,
    _txChain: txChain,
  };

  return db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VendorStaffService", () => {
  let db: ReturnType<typeof makeDbMock>;
  let mailer: ReturnType<typeof makeMailerMock>;

  beforeEach(() => {
    db = makeDbMock();
    mailer = makeMailerMock();
    vi.clearAllMocks();
  });

  describe("invite", () => {
    it("throws when role is 'owner' (T-06-16 — no owner minting via invite)", async () => {
      const { VendorStaffService } = await import("./VendorStaffService.js");
      const svc = new VendorStaffService({
        db: db as never,
        mailer: mailer as never,
        env: { WEB_VENDOR_URL: "http://localhost:5174", SMTP_FROM: "test@test.com", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "" } as never,
      });

      await expect(
        svc.invite("v-1", "user-1", { email: "owner@test.com", role: "owner" as never })
      ).rejects.toThrow();
    });

    it("creates invite row with unique token and 48h expiry", async () => {
      const { VendorStaffService } = await import("./VendorStaffService.js");
      const svc = new VendorStaffService({
        db: db as never,
        mailer: mailer as never,
        env: { WEB_VENDOR_URL: "http://localhost:5174", SMTP_FROM: "test@test.com", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "" } as never,
      });

      (db._selectChain as Record<string, Mock>).limit.mockResolvedValueOnce([]); // no existing invite

      await svc.invite("v-1", "user-1", { email: "staff@test.com", role: "staff" });

      expect(db.insert).toHaveBeenCalledOnce();
      const insertedValues = (db._insertChain as Record<string, Mock>).values.mock.calls[0]?.[0] as Record<string, unknown>;

      // Should have a token
      expect(insertedValues).toHaveProperty("inviteToken");
      expect(typeof insertedValues["inviteToken"]).toBe("string");

      // ExpiresAt should be about 48h in the future
      const expiresAt = insertedValues["expiresAt"] as Date;
      const nowPlus48h = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const nowPlus47h = new Date(Date.now() + 47 * 60 * 60 * 1000);
      expect(expiresAt.getTime()).toBeGreaterThan(nowPlus47h.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(nowPlus48h.getTime() + 5000);
    });

    it("sends an invite email via mailer", async () => {
      const { VendorStaffService } = await import("./VendorStaffService.js");
      const svc = new VendorStaffService({
        db: db as never,
        mailer: mailer as never,
        env: { WEB_VENDOR_URL: "http://localhost:5174", SMTP_FROM: "test@test.com", SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASS: "p" } as never,
      });

      (db._selectChain as Record<string, Mock>).limit.mockResolvedValueOnce([]);

      await svc.invite("v-1", "user-1", { email: "manager@test.com", role: "manager" });

      expect(mailer.sendMail).toHaveBeenCalledOnce();
      const mailArg = mailer.sendMail.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(mailArg).toHaveProperty("to", "manager@test.com");
      expect(String(mailArg["html"])).toMatch(/accept-invite/);
    });
  });

  describe("accept", () => {
    it("rejects if invite token not found", async () => {
      const { VendorStaffService, InvalidInviteTokenError } = await import("./VendorStaffService.js");
      const svc = new VendorStaffService({
        db: db as never,
        mailer: mailer as never,
        env: {} as never,
      });

      (db._selectChain as Record<string, Mock>).limit.mockResolvedValueOnce([]);

      await expect(
        svc.accept({ token: "invalid-token", password: "password123" })
      ).rejects.toThrow(InvalidInviteTokenError);
    });

    it("rejects if invite is already accepted (acceptedAt is set)", async () => {
      const { VendorStaffService, InvalidInviteTokenError } = await import("./VendorStaffService.js");
      const svc = new VendorStaffService({
        db: db as never,
        mailer: mailer as never,
        env: {} as never,
      });

      (db._selectChain as Record<string, Mock>).limit.mockResolvedValueOnce([
        {
          id: "invite-1",
          vendorId: "v-1",
          email: "staff@test.com",
          role: "staff",
          inviteToken: "test-token",
          invitedBy: "owner-1",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // not expired
          acceptedAt: new Date(), // already accepted
          createdAt: new Date(),
        },
      ]);

      await expect(
        svc.accept({ token: "test-token", password: "password123" })
      ).rejects.toThrow(InvalidInviteTokenError);
    });

    it("rejects if invite is expired", async () => {
      const { VendorStaffService, InvalidInviteTokenError } = await import("./VendorStaffService.js");
      const svc = new VendorStaffService({
        db: db as never,
        mailer: mailer as never,
        env: {} as never,
      });

      (db._selectChain as Record<string, Mock>).limit.mockResolvedValueOnce([
        {
          id: "invite-1",
          vendorId: "v-1",
          email: "staff@test.com",
          role: "staff",
          inviteToken: "test-token",
          invitedBy: "owner-1",
          expiresAt: new Date(Date.now() - 1000), // expired
          acceptedAt: null,
          createdAt: new Date(),
        },
      ]);

      await expect(
        svc.accept({ token: "test-token", password: "password123" })
      ).rejects.toThrow(InvalidInviteTokenError);
    });

    it("creates vendor_users row and sets acceptedAt on valid token", async () => {
      const { VendorStaffService } = await import("./VendorStaffService.js");
      const svc = new VendorStaffService({
        db: db as never,
        mailer: mailer as never,
        env: {} as never,
      });

      // First select returns the valid invite
      (db._selectChain as Record<string, Mock>).limit.mockResolvedValueOnce([
        {
          id: "invite-1",
          vendorId: "v-1",
          email: "staff@test.com",
          role: "staff",
          inviteToken: "valid-token",
          invitedBy: "owner-1",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          acceptedAt: null,
          createdAt: new Date(),
        },
      ]);

      // Transaction mock — insert vendor_users, update invite
      const txInsert = { values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([{ id: "new-user-id" }]) };
      const txUpdate = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
      (db as Record<string, Mock>).transaction.mockImplementationOnce(
        async (cb: (tx: { insert: Mock; update: Mock }) => Promise<unknown>) => {
          return cb({ insert: vi.fn().mockReturnValue(txInsert), update: vi.fn().mockReturnValue(txUpdate) });
        }
      );

      await svc.accept({ token: "valid-token", password: "secretpassword123" });

      // Should have called the transaction
      expect((db as Record<string, Mock>).transaction).toHaveBeenCalledOnce();
    });
  });

  describe("listStaff", () => {
    it("returns active vendor_users for the vendor", async () => {
      const { VendorStaffService } = await import("./VendorStaffService.js");
      const svc = new VendorStaffService({
        db: db as never,
        mailer: mailer as never,
        env: {} as never,
      });

      (db._selectChain as Record<string, Mock>).limit.mockResolvedValueOnce([
        { id: "u1", email: "manager@store.com", role: "manager", acceptedAt: new Date(), invitedBy: "owner-1", createdAt: new Date() },
        { id: "u2", email: "staff@store.com", role: "staff", acceptedAt: new Date(), invitedBy: "owner-1", createdAt: new Date() },
      ]);

      const staff = await svc.listStaff("v-1");
      expect(staff).toHaveLength(2);
    });
  });

  describe("removeStaff", () => {
    it("throws when trying to remove an owner", async () => {
      const { VendorStaffService, CannotRemoveOwnerError } = await import("./VendorStaffService.js");
      const svc = new VendorStaffService({
        db: db as never,
        mailer: mailer as never,
        env: {} as never,
      });

      // The user to remove is an owner
      (db._selectChain as Record<string, Mock>).limit.mockResolvedValueOnce([
        { id: "owner-1", vendorId: "v-1", role: "owner", archivedAt: null },
      ]);

      await expect(svc.removeStaff("v-1", "owner-1")).rejects.toThrow(CannotRemoveOwnerError);
    });

    it("soft-deletes (sets archivedAt) for non-owner staff", async () => {
      const { VendorStaffService } = await import("./VendorStaffService.js");
      const svc = new VendorStaffService({
        db: db as never,
        mailer: mailer as never,
        env: {} as never,
      });

      (db._selectChain as Record<string, Mock>).limit.mockResolvedValueOnce([
        { id: "staff-1", vendorId: "v-1", role: "staff", archivedAt: null },
      ]);

      await svc.removeStaff("v-1", "staff-1");

      expect(db.update).toHaveBeenCalledOnce();
      const setArgs = (db._updateChain as Record<string, Mock>).set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setArgs).toHaveProperty("archivedAt");
      expect(setArgs["archivedAt"]).toBeInstanceOf(Date);
    });
  });
});
