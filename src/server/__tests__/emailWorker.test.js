import { describe, expect, it, vi } from "vitest";
import worker from "../../../scripts/grvhqEmailWorker.js";

describe("GRVHQ email routing worker", () => {
  it("preserves Yahoo forwarding and delivers a dashboard copy with the envelope recipient", async () => {
    const message = { to: "fegorovie@grvhq.com", forward: vi.fn().mockResolvedValue(undefined) };
    await worker.email(message);
    expect(message.forward.mock.calls.map(([address]) => address)).toEqual(["grvwears@yahoo.com", "dashboard@inbound.grvhq.com"]);
    expect(message.forward.mock.calls[1][1].get("X-GRVHQ-Original-Recipient")).toBe("fegorovie@grvhq.com");
  });
  it("still attempts Yahoo when dashboard forwarding fails, and reports the failure", async () => {
    const message = { to: "support@grvhq.com", forward: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("failed")) };
    await expect(worker.email(message)).rejects.toThrow("delivery failed");
    expect(message.forward).toHaveBeenCalledTimes(2);
  });
  it("rejects unrelated addresses", async () => {
    const message = { to: "other@grvhq.com", forward: vi.fn(), setReject: vi.fn() };
    await worker.email(message);
    expect(message.setReject).toHaveBeenCalled();
    expect(message.forward).not.toHaveBeenCalled();
  });
});
