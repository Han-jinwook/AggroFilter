export function createClient(): any {
  const missingMessage =
    "Supabase server client is not configured. Add a real Supabase server client implementation (e.g. @supabase/ssr) and required env vars.";

  const makeError = () => {
    const err = new Error(missingMessage);
    return err;
  };

  const makeAwaitableQuery = () => {
    const query: any = {
      select: () => query,
      eq: () => query,
      single: () => query,
      order: () => query,
      limit: () => query,
      gte: () => query,
      lte: () => query,
      update: () => query,
      upsert: () => query,
      then: (resolve: any) =>
        Promise.resolve(resolve({ data: null, error: makeError() })),
      catch: (reject: any) => Promise.resolve(reject(makeError())),
    };

    return query;
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: makeError() }),
    },
    from: () => makeAwaitableQuery(),
  };
}
