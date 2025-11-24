export enum AppMode {
  GENERAL_CHAT = 'GENERAL_CHAT',
  CAREER_ANALYSIS = 'CAREER_ANALYSIS'
}

export enum ModelType {
  GEMINI_FLASH = 'gemini-2.5-flash',
  GEMINI_PRO = 'gemini-3-pro-preview',
  GEMINI_PRO_IMAGE = 'gemini-3-pro-image-preview',
}

export interface Attachment {
  file: File;
  previewUrl: string;
  type: 'image' | 'video' | 'audio' | 'application';
  base64?: string;
  mimeType: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  attachments?: Attachment[];
  timestamp: number;
  isThinking?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: number;
}
