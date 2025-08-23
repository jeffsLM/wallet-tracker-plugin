import { WhatsappSocket } from '../types';
import { proto } from '@whiskeysockets/baileys';
import { imageDownloadService } from '../services/imageDownload.service';
import { ocrService } from '../services/ocr.service';
import { stringAnalyzerService } from '../services/stringAnalyzer.service';
import { cardManagementService } from '../services/cardManagement.service';
import { whatsappMessage } from '../services/whatappMessage.service';
import { messageFormatter } from '../utils/message.formatter.utils';
import { userUtils } from '../utils/user.utils';

interface ImageMessageRequest {
  msg: proto.IWebMessageInfo;
  sock: WhatsappSocket;
}

export const imageMessageHandler = {
  async handle({ msg, sock }: ImageMessageRequest): Promise<void> {
    try {
      console.log('📨 Nova imagem recebida do grupo alvo');

      const senderJid = msg.key.participant || msg.key.remoteJid || '';
      const senderName = await userUtils.getSenderName(sock, senderJid, msg.key.remoteJid || '');

      // Check if user already has a pending card
      if (await this.checkExistingPendingCard(senderJid, senderName, sock, msg)) {
        return;
      }

      // Process the image
      await this.processNewImage(senderJid, senderName, sock, msg);

    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: messageFormatter.createErrorMessage('ERRO INTERNO', 'Falha ao processar a imagem.', 'Tente novamente em alguns instantes.\n🆘 Se o problema persistir, entre em contato com o suporte.'),
        ...(msg.message ? { quoted: msg.message } : {})
      });
    }
  },

  async checkExistingPendingCard(
    senderJid: string,
    senderName: string,
    sock: WhatsappSocket,
    msg: proto.IWebMessageInfo
  ): Promise<boolean> {
    const existingCard = cardManagementService.getPendingCardByUser(senderJid);

    if (existingCard) {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: messageFormatter.createPendingCardMessage(senderName, existingCard),
        ...(msg.message ? { quoted: msg.message } : {})
      });
      return true;
    }

    return false;
  },

  async processNewImage(
    senderJid: string,
    senderName: string,
    sock: WhatsappSocket,
    msg: proto.IWebMessageInfo
  ): Promise<void> {
    // Send processing message
    await whatsappMessage.sendText(sock, {
      jid: msg.key.remoteJid || '',
      text: `🔄 *PROCESSANDO IMAGEM*...`,
      ...(msg.message ? { quoted: msg.message } : {})
    });

    // Download image
    const downloadResult = await imageDownloadService.downloadAndSaveImage(msg);
    if (!downloadResult.success || !downloadResult.filePath) {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: messageFormatter.createErrorMessage('ERRO NO DOWNLOAD', downloadResult.error, 'Tente enviar a imagem novamente.'),
        ...(msg.message ? { quoted: msg.message } : {})
      });
      return;
    }

    // Process OCR
    const ocrResult = await ocrService.processImage(downloadResult.filePath);
    if (!ocrResult.success || !ocrResult.text) {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: messageFormatter.createOcrErrorMessage(ocrResult.error),
        ...(msg.message ? { quoted: msg.message } : {})
      });
      return;
    }

    // Analyze and create card
    const cardInfo = stringAnalyzerService.analyzeCardInfo(ocrResult.text);
    const result = await cardManagementService.createPendingCard({
      purchaseType: cardInfo.type || 'Não identificado',
      amount: cardInfo.amount || 'Não identificado',
      parcelas: cardInfo.installments,
      lastFourDigits: cardInfo.lastFourDigits || 'Não identificado',
      user: senderName,
      ocrText: ocrResult.text,
      senderJid,
      groupJid: msg.key.remoteJid || '',
      filePath: downloadResult.filePath
    });

    if (!result.success) await whatsappMessage.sendText(sock, {
      jid: msg.key.remoteJid || '',
      text: messageFormatter.createErrorMessage('ERRO AO CRIAR COMPROVANTE', result.error, 'Tente processar a imagem novamente.'),
      ...(msg.message ? { quoted: msg.message } : {})
    });

    await whatsappMessage.sendText(sock, {
      jid: msg.key.remoteJid || '',
      text: messageFormatter.createProcessedCardMessage(result.card),
      ...(msg.message ? { quoted: msg.message } : {})
    });


    await imageDownloadService.cleanupOldImages();
  }
};
