export const supabase = {
  from: () => ({ select: async () => ({ data: null, error: null }), insert: async () => ({ data: null, error: null }), update: async () => ({ data: null, error: null }), delete: async () => ({ data: null, error: null }) }),
  channel: () => ({ on: function() { return this; }, subscribe: function() { return this; } }),
  removeChannel: () => {},
};
