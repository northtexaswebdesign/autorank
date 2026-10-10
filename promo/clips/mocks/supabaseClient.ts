export const supabaseUrl = 'http://localhost';
export const supabase: any = new Proxy({}, { get: () => () => ({}) });
