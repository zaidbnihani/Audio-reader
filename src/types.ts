export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider: 'google';
  loggedInAt: number;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  tone: string;
  toneAr: string;
  description: string;
  descriptionAr: string;
}

export interface TTSResponse {
  success: boolean;
  audioBase64?: string;
  mimeType?: string;
  duration?: number;
  voice?: string;
  sampleRate?: number;
  engine?: string;
  error?: string;
  isQuotaExceeded?: boolean;
  waitSeconds?: number;
}

export interface GeneratedAudioItem {
  id: string;
  text: string;
  voice: string;
  audioUrl: string;
  blob: Blob;
  duration: number;
  timestamp: number;
}
