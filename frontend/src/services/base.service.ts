import type {
  Conversation,
  ConversationWithMessages,
  ChatResponse,
  OCRResponse,
} from '../interface';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL as string;
  }

  /**
   * Fetch all conversations
   * @throws {Error} If the request fails
   */
  async getConversations(): Promise<Conversation[]> {
    try {
      const response = await fetch(`${this.baseUrl}/conversations`);
      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error in getConversations:', error);
      throw error;
    }
  }

  /**
   * Get a specific conversation with messages
   * @param conversationId - The ID of the conversation to fetch
   * @throws {Error} If the request fails
   */
  async getConversationById(conversationId: number): Promise<ConversationWithMessages> {
    try {
      const response = await fetch(`${this.baseUrl}/conversations/${conversationId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch conversation: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error in getConversationById (ID: ${conversationId}):`, error);
      throw error;
    }
  }

  /**
   * Create a new conversation
   * @param data - The conversation data
   * @throws {Error} If the request fails
   */
  async createConversation(data: {
    insurer: string;
    plan: string;
    bill_text: string;
  }): Promise<Conversation> {
    try {
      const response = await fetch(`${this.baseUrl}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create conversation: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error in createConversation:', error);
      throw error;
    }
  }

  /**
   * Delete a conversation
   * @param conversationId - The ID of the conversation to delete
   * @throws {Error} If the request fails
   */
  async deleteConversation(conversationId: number): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/conversations/${conversationId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete conversation: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error in deleteConversation (ID: ${conversationId}):`, error);
      throw error;
    }
  }

  /**
   * Send a chat message
   * @param data - The message data
   * @throws {Error} If the request fails
   */
  async sendChatMessage(data: {
    conversation_id: number;
    user_input: string;
  }): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error in sendChatMessage:', error);
      throw error;
    }
  }

  /**
   * OCR for PDF files
   * @param pdfBase64 - Base64 encoded PDF data
   * @throws {Error} If the request fails
   */
  async extractTextFromPDF(pdfBase64: string): Promise<OCRResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/ocr/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_base64: pdfBase64 }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to process PDF: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error in extractTextFromPDF:', error);
      throw error;
    }
  }

  /**
   * OCR for image files
   * @param imageDataUrl - Data URL of the image
   * @throws {Error} If the request fails
   */
  async extractTextFromImage(imageDataUrl: string): Promise<OCRResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/ocr/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data_url: imageDataUrl }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to process image: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error in extractTextFromImage:', error);
      throw error;
    }
  }

  /**
   * Get all available insurers
   * @throws {Error} If the request fails
   */
  async getInsurers(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/insurers`);
      if (!response.ok) {
        throw new Error(`Failed to fetch insurers: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error in getInsurers:', error);
      throw error;
    }
  }

  /**
   * Get plans for a specific insurer
   * @param insurerId - The ID of the insurer
   * @throws {Error} If the request fails
   */
  async getPlansByInsurer(insurerId: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/plans?insurer=${encodeURIComponent(insurerId)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch plans: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error in getPlansByInsurer (Insurer: ${insurerId}):`, error);
      throw error;
    }
  }
}

// Export a singleton instance
const apiService = new ApiService();
export default apiService;

// Also export the class for testing or multiple instances if needed
export { ApiService };

// Re-export types from interface for convenience
export type {
  Conversation,
  ConversationWithMessages,
  Message,
  ChatResponse,
  OCRResponse,
  Insurer,
  Plan,
  UploadedDocument,
  ChatMessage,
} from '../interface';
