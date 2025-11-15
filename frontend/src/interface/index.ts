export interface Insurer {
    id: string;
    name: string;
    created_at: string;
  }
  
  export interface Plan {
    id: string;
    insurer_id: string;
    name: string;
    details: {
      coverage: string;
      deductible: string;
      annual_limit: string;
      claim_processing: string;
    };
    created_at: string;
  }
  
  export interface UploadedDocument {
    id: string;
    file_name: string;
    file_type: string;
    file_data: string;
    insurer_id: string;
    plan_id: string;
    created_at: string;
  }
  
  export interface ChatMessage {
    id: string;
    document_id: string;
    message: string;
    is_user: boolean;
    created_at: string;
  }
  

// Response Types
export interface Conversation {
  id: number;
  insurer: string;
  plan: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

export interface ConversationWithMessages {
  id: number;
  insurer: string;
  plan: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

export interface ChatResponse {
  messages: Message[];
}

export interface OCRResponse {
  text: string;
}