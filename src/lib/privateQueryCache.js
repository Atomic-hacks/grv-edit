import { PERSISTED_QUERY_ROOTS } from "./queryPersistence.js";

// Cancel first so an old session's in-flight response cannot repopulate
// private data after the cache is removed. Called before publishing identity.
export const clearPrivateQueries = (client) => {
  const filters = { predicate: (query) => !PERSISTED_QUERY_ROOTS.has(query.queryKey[0]) };
  const cancelled = client.cancelQueries(filters);
  client.removeQueries(filters);
  return cancelled;
};
