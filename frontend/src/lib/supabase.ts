// import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// export const supabase = createClient(supabaseUrl, supabaseKey);

// export interface Insurer {
//   id: string;
//   name: string;
//   created_at: string;
// }

// export interface Plan {
//   id: string;
//   insurer_id: string;
//   name: string;
//   details: {
//     coverage: string;
//     deductible: string;
//     annual_limit: string;
//     claim_processing: string;
//   };
//   created_at: string;
// }

// export interface UploadedDocument {
//   id: string;
//   file_name: string;
//   file_type: string;
//   file_data: string;
//   insurer_id: string;
//   plan_id: string;
//   created_at: string;
// }

// export interface ChatMessage {
//   id: string;
//   document_id: string;
//   message: string;
//   is_user: boolean;
//   created_at: string;
// }
