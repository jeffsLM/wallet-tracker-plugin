import type {
  AuthenticationState,
  ConnectionState,
  DisconnectReason,
  MessageUpsertType,
  proto,
  AnyMessageContent,
  WAMessage,
  WASocket,
  WAConnectionState,
} from '@whiskeysockets/baileys';

export interface WhatsappMessage {
  key: {
    fromMe: boolean;
    remoteJid: string;
  };
  message?: proto.IMessage;
}

export interface OCRResponse {
  ParsedResults?: Array<{
    TextOverlay: {
      Lines: Array<{
        LineText: string;
      }>;
    };
    ParsedText: string;
  }>;
  OCRExitCode: number;
  IsErroredOnProcessing: boolean;
  ErrorMessage?: string;
  ErrorDetails?: string;
}

export type ConnectionUpdate = {
  qr?: string;
  connection?: WAConnectionState;
  lastDisconnect?: {
    error: any;
  };
};

export type MessagesUpsert = {
  messages: WAMessage[];
  type: MessageUpsertType;
  sock: WhatsappSocket;
};


export type AuthState = AuthenticationState;

export type WhatsappSocket = WASocket;

export type SendMessage = (jid: string, content: AnyMessageContent) => Promise<void>;
