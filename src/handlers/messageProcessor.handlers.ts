import { MessagesUpsert, WhatsappSocket } from '../types';
import { imageDownloadService } from '../services/imageDownload.service';
import { ocrService } from '../services/ocr.service';
import { proto } from '@whiskeysockets/baileys';
import { stringAnalyzerService } from '../services/stringAnalyzer.service';
import { whatsappMessage } from '../services/whatappMessage.service';
import { cardManagementService } from '../services/cardManagement.service';

interface ProcessImageMessage {
  msg: proto.IWebMessageInfo;
  sock: WhatsappSocket;
}

const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID

// Field mapping for Portuguese commands to English data fields
const FIELD_COMMANDS = {
  'tipo': 'purchaseType',
  'valor': 'amount',
  'pagamento': 'payment',
  'parcelas': 'parcelas'
} as const;

export async function handleMessagesUpsertFiles({ messages, sock }: MessagesUpsert): Promise<void> {
  for (const msg of messages) {
    if (msg.message && msg.key.remoteJid === TARGET_GROUP_ID) {
      if (msg.message.imageMessage) return await processImageMessage({ msg, sock });
      if (msg.message.conversation || msg.message.extendedTextMessage) await handleTextMessage({ msg, sock });
    }
  }
}

async function handleTextMessage({ msg, sock }: ProcessImageMessage): Promise<void> {
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  const senderJid = msg.key.participant || msg.key.remoteJid || '';

  // Check commands
  const lowerText = text.toLowerCase().trim();

  if (lowerText.includes('1')) {
    await handleConfirmation(senderJid, sock, msg);
    return;
  }

  if (lowerText.startsWith('3') || lowerText.startsWith('editar')) {
    await handleEdit(text, senderJid, sock, msg);
    return;
  }

  if (lowerText.includes('2')) {
    await handleCancel(senderJid, sock, msg);
    return;
  }

  if (lowerText.includes('status') || lowerText.includes('meus cartoes')) {
    await handleStatus(senderJid, sock, msg);
    return;
  }
}

async function handleConfirmation(senderJid: string, sock: WhatsappSocket, msg: proto.IWebMessageInfo): Promise<void> {
  try {
    const pendingCard = cardManagementService.getPendingCardByUser(senderJid);

    if (!pendingCard) {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `❌ *ERRO*

_Nenhum comprovante pendente encontrado para você._

📷 Envie uma imagem do seu comprovante para começar.`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
      return;
    }

    const result = await cardManagementService.confirmCard(pendingCard.id);

    if (result.success) {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `✅ *COMPROVANTE CONFIRMADO*

${cardManagementService.formatCardInfo(result.card!)}

━━━━━━━━━━━━━━━━
💾 *Status:* Salvo permanentemente
🆔 *ID:* ${result.card!.id.substring(0, 8)}...`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
    } else {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `❌ *ERRO AO CONFIRMAR*

_${result.error}_

🔄 Tente novamente ou entre em contato com o suporte.`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
    }
  } catch (error) {
    console.error('Erro ao confirmar comprovante:', error);
    await whatsappMessage.sendText(sock, {
      jid: msg.key.remoteJid || '',
      text: `❌ *ERRO INTERNO*

_Falha ao confirmar comprovante._

🔄 Tente novamente em alguns instantes.`,
      ...(msg.message ? { quoted: msg.message } : {})
    });
  }
}

async function handleEdit(text: string, senderJid: string, sock: WhatsappSocket, msg: proto.IWebMessageInfo): Promise<void> {
  try {
    const pendingCard = cardManagementService.getPendingCardByUser(senderJid);

    if (!pendingCard) {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `❌ *ERRO*

_Nenhum comprovante pendente encontrado para você._

📷 Envie uma imagem do seu comprovante para começar.`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
      return;
    }

    const editCommand = parseEditCommand(text);
    if (!editCommand) {
      const fieldsList = Object.keys(FIELD_COMMANDS).map(field => `• *${field}*`).join('\n');

      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `❌ *FORMATO INVÁLIDO*

📝 *Como usar:*
_"3 [campo] [novo valor]"_

*Exemplos:*
• \`3 tipo Crédito\`
• \`3 valor R$ 250,00\`
• \`3 pagamento Parcelado\`
• \`3 parcelas 6\`

━━━━━━━━━━━━━━━━
🔧 *Campos editáveis:*
${fieldsList}`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
      return;
    }

    const result = await cardManagementService.editPendingCard(pendingCard.id, editCommand.updates);

    if (result.success) {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `✅ *CAMPO ATUALIZADO*

${cardManagementService.formatCardInfo(result.card!)}

━━━━━━━━━━━━━━━━
⚙️ *COMANDOS DISPONÍVEIS:*

*[1]* ✅ Confirmar comprovante
*[2]* ❌ Cancelar comprovante
*[3]* 🔧 Editar informações

_Digite apenas o número da opção desejada._`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
    } else {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `❌ *ERRO AO EDITAR*

_${result.error}_

🔄 Verifique o formato e tente novamente.`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
    }
  } catch (error) {
    console.error('Erro ao editar comprovante:', error);
    await whatsappMessage.sendText(sock, {
      jid: msg.key.remoteJid || '',
      text: `❌ *ERRO INTERNO*

_Falha ao editar comprovante._

🔄 Tente novamente em alguns instantes.`,
      ...(msg.message ? { quoted: msg.message } : {})
    });
  }
}

async function handleCancel(senderJid: string, sock: WhatsappSocket, msg: proto.IWebMessageInfo): Promise<void> {
  try {
    const pendingCard = cardManagementService.getPendingCardByUser(senderJid);

    if (!pendingCard) {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `❌ *ERRO*

_Nenhum comprovante pendente encontrado para você._

📷 Envie uma imagem do seu comprovante para começar.`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
      return;
    }

    const result = await cardManagementService.cancelCard(pendingCard.id);

    if (result.success) {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `🗑️ *COMPROVANTE CANCELADO*

🆔 *ID:* ${result.card!.id.substring(0, 8)}...
📅 *Data:* ${new Date().toLocaleDateString('pt-BR')}

━━━━━━━━━━━━━━━━
_O comprovante foi removido e não será salvo no sistema._

📷 Envie uma nova imagem para processar outro comprovante.`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
    } else {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `❌ *ERRO AO CANCELAR*

_${result.error}_

🔄 Tente novamente ou entre em contato com o suporte.`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
    }
  } catch (error) {
    console.error('Erro ao cancelar comprovante:', error);
  }
}

async function handleStatus(senderJid: string, sock: WhatsappSocket, msg: proto.IWebMessageInfo): Promise<void> {
  try {
    const pendingCard = cardManagementService.getPendingCardByUser(senderJid);
    const stats = cardManagementService.getStats();

    let statusText = `📊 *STATUS DO SISTEMA*

━━━━━━━━━━━━━━━━
🟡 *Pendentes:* ${stats.pending}
✅ *Confirmados:* ${stats.confirmed}
👥 *Usuários:* ${stats.users}
💰 *Valor Total:* R$ ${stats.totalValue.toFixed(2).replace('.', ',')}`;

    if (pendingCard) {
      statusText += `

━━━━━━━━━━━━━━━━
🔄 *SEU COMPROVANTE PENDENTE:*

${cardManagementService.formatCardInfo(pendingCard)}

━━━━━━━━━━━━━━━━
⚙️ *COMANDOS DISPONÍVEIS:*

*[1]* ✅ Confirmar comprovante
*[2]* ❌ Cancelar comprovante
*[3]* 🔧 Editar informações

_Digite apenas o número da opção desejada._`;
    } else {
      statusText += `

━━━━━━━━━━━━━━━━
✅ *Você não possui comprovantes pendentes.*

📷 Envie uma imagem para processar um novo comprovante.`;
    }

    await whatsappMessage.sendText(sock, {
      jid: msg.key.remoteJid || '',
      text: statusText,
      ...(msg.message ? { quoted: msg.message } : {})
    });
  } catch (error) {
    console.error('Erro ao consultar status:', error);
  }
}

function parseEditCommand(text: string): { field: string; value: string | number; updates: any } | null {
  // Format: "3 tipo Débito" or "editar tipo Débito" or "3 parcelas 3"
  const match = text.match(/(?:3|editar)\s+(\w+)\s+(.+)/i);

  if (!match) return null;

  const fieldKey = match[1].toLowerCase();
  const value = match[2].trim();

  const field = FIELD_COMMANDS[fieldKey as keyof typeof FIELD_COMMANDS];
  if (!field) return null;

  const updates: any = {};

  // Handle numeric fields
  if (field === 'parcelas') {
    const numericValue = parseInt(value);
    if (isNaN(numericValue)) {
      return null;
    }
    updates[field] = numericValue;
    return {
      field: fieldKey,
      value: numericValue,
      updates
    };
  } else {
    updates[field] = value;
    return {
      field: fieldKey,
      value,
      updates
    };
  }
}

async function processImageMessage({ msg, sock }: ProcessImageMessage): Promise<void> {
  try {
    console.log('📨 Nova imagem recebida do grupo alvo');

    const senderJid = msg.key.participant || msg.key.remoteJid || '';
    const senderName = await getSenderName(sock, senderJid, msg.key.remoteJid || '');

    // Check if user already has a pending card
    const existingCard = cardManagementService.getPendingCardByUser(senderJid);
    if (existingCard) {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `⚠️ *COMPROVANTE PENDENTE*

_${senderName}, você já possui um comprovante aguardando confirmação!_

${cardManagementService.formatCardInfo(existingCard)}

━━━━━━━━━━━━━━━━
⚙️ *COMANDOS DISPONÍVEIS:*

*[1]* ✅ Confirmar comprovante atual
*[2]* ❌ Cancelar comprovante atual

_Confirme ou cancele antes de enviar outro._`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
      return;
    }

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
        text: `❌ *ERRO NO DOWNLOAD*

_${downloadResult.error}_

🔄 Tente enviar a imagem novamente.`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
      return;
    }

    // Process OCR
    const ocrResult = await ocrService.processImage(downloadResult.filePath);
    if (!ocrResult.success || !ocrResult.text) {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `❌ *ERRO NO PROCESSAMENTO*

_${ocrResult.error}_

💡 *Dicas:*
• Certifique-se que a imagem está nítida
• Verifique se todo o comprovante está visível
• Evite sombras ou reflexos`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
      return;
    }

    // Analyze card information using stringAnalyzer
    const cardInfo = stringAnalyzerService.analyzeCardInfo(ocrResult.text);

    // Create card in service
    const result = await cardManagementService.createPendingCard({
      purchaseType: cardInfo.type || 'Não identificado',
      amount: cardInfo.amount || 'Não identificado',
      payment: cardInfo.type || 'Não identificado',
      parcelas: cardInfo.installments,
      lastFourDigits: cardInfo.lastFourDigits || 'Não identificado',
      user: senderName,
      ocrText: ocrResult.text,
      senderJid,
      groupJid: msg.key.remoteJid || '',
      filePath: downloadResult.filePath
    });

    if (result.success && result.card) {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `✅ *COMPROVANTE PROCESSADO*

${cardManagementService.formatCardInfo(result.card)}

━━━━━━━━━━━━━━━━
⚙️ *COMANDOS DISPONÍVEIS:*
_Confirme o comprovante caso esteja tudo correto!_


*[1]* ✅ Confirmar e salvar
*[2]* ❌ Cancelar comprovante
*[3]* 🔧 Editar informações

_Digite apenas o número da opção desejada._
`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
    } else {
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `❌ *ERRO AO CRIAR COMPROVANTE*

_${result.error}_

🔄 Tente processar a imagem novamente.`,
        ...(msg.message ? { quoted: msg.message } : {})
      });
    }

    await imageDownloadService.cleanupOldImages();

  } catch (error) {
    console.error('Erro ao processar imagem:', error);
    await whatsappMessage.sendText(sock, {
      jid: msg.key.remoteJid || '',
      text: `❌ *ERRO INTERNO*

_Falha ao processar a imagem._

🔄 Tente novamente em alguns instantes.
🆘 Se o problema persistir, entre em contato com o suporte.`,
      ...(msg.message ? { quoted: msg.message } : {})
    });
  }
}

async function getSenderName(sock: WhatsappSocket, senderJid: string, groupJid: string): Promise<string> {
  try {
    // Extract phone number from JID
    const phoneNumber = senderJid.split('@')[0];

    try {
      if (groupJid) {
        const groupMeta = await sock.groupMetadata(groupJid);
        const participant = groupMeta.participants.find(p => p.id === senderJid);

        if (participant) {
          // Check if there are name information available
          const participantData = participant as any;
          if (participantData.notify) return participantData.notify;
          if (participantData.name) return participantData.name;
        }
      }
    } catch (groupError) {
      console.log('Não foi possível obter metadata do grupo');
    }

    // Fallback: use phone number
    return phoneNumber;

  } catch (error) {
    console.error('Erro ao obter nome do remetente:', error);
    return senderJid.split('@')[0];
  }
}
