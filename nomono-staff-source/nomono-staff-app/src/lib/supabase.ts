import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sysamlqxpdzgoanccjjt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5c2FtbHF4cGR6Z29hbmNjamp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTA1NDIsImV4cCI6MjA5MTkyNjU0Mn0.0a0ziY7qnEUT9KVKY_3Xia-TuSaYjjIYxUnIno_85Ok';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
