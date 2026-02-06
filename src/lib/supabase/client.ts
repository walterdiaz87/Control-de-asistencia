import { createBrowserClient } from '@supabase/ssr';

export const createClient = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.warn('Supabase credentials missing. Using placeholders. Check Vercel environment variables.');
    }

    return createBrowserClient(
        url || 'https://placeholder.supabase.co',
        key || 'placeholder'
    );
};
