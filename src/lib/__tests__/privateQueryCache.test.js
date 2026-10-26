import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { clearPrivateQueries } from "../privateQueryCache.js";

it("removes previous staff data and prevents a late response from restoring it", async () => {
  const client = new QueryClient();
  client.setQueryData(["admin", "customers"], [{ email: "private@test.local" }]);
  client.setQueryData(["products"], [{ id: "public" }]);
  let finish;
  const pending = client.fetchQuery({ queryKey: ["admin", "orders"], queryFn: () => new Promise((resolve) => { finish = resolve; }) }).catch(() => {});
  await clearPrivateQueries(client);
  finish([{ id: "old-session" }]);
  await pending;
  expect(client.getQueryData(["admin", "customers"])).toBeUndefined();
  expect(client.getQueryData(["admin", "orders"])).toBeUndefined();
  expect(client.getQueryData(["products"])).toEqual([{ id: "public" }]);
  client.clear();
});
