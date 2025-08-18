import { cardManagementService } from '../services/cardManagement.service';

export const messageFormatter = {
  createErrorMessage(title: string, error: string | undefined, suggestion?: string): string {
    return `❌ *${title}*

_${error}_

${suggestion ? `🔄 ${suggestion}` : ''}`;
  },

  createNoPendingCardMessage(): string {
    return `❌ *ERRO*

_Nenhum comprovante pendente encontrado para você._

📷 Envie uma imagem do seu comprovante para começar.`;
  },

  createPendingCardMessage(senderName: string, existingCard: any): string {
    return `⚠️ *COMPROVANTE PENDENTE*

_${senderName}, você já possui um comprovante aguardando confirmação!_

${cardManagementService.formatCardInfo(existingCard)}

━━━━━━━━━━━━━━━━
⚙️ *COMANDOS DISPONÍVEIS:*

*[1]* ✅ Confirmar comprovante atual
*[2]* ❌ Cancelar comprovante atual

_Confirme ou cancele antes de enviar outro._`;
  },

  createOcrErrorMessage(error: string | undefined): string {
    return `❌ *ERRO NO PROCESSAMENTO*

_${error}_

💡 *Dicas:*
• Certifique-se que a imagem está nítida
• Verifique se todo o comprovante está visível
• Evite sombras ou reflexos`;
  },

  createProcessedCardMessage(card: any): string {
    return `✅ *COMPROVANTE PROCESSADO*

${cardManagementService.formatCardInfo(card)}

━━━━━━━━━━━━━━━━
⚙️ *COMANDOS DISPONÍVEIS:*
_Confirme o comprovante caso esteja tudo correto!_


*[1]* ✅ Confirmar e salvar
*[2]* ❌ Cancelar comprovante
*[3]* 🔧 Editar informações

_Digite apenas o número da opção desejada._`;
  },

  createConfirmedCardMessage(card: any): string {
    return `✅ *COMPROVANTE CONFIRMADO*

${cardManagementService.formatCardInfo(card)}

━━━━━━━━━━━━━━━━
💾 *Status:* Salvo permanentemente
🆔 *ID:* ${card.id.substring(0, 8)}...`;
  },

  createEditHelpMessage(): string {
    const FIELD_COMMANDS = {
      'tipo': 'purchaseType',
      'valor': 'amount',
      'pagamento': 'payment',
      'parcelas': 'parcelas'
    } as const;

    const fieldsList = Object.keys(FIELD_COMMANDS).map(field => `• *${field}*`).join('\n');

    return `❌ *FORMATO INVÁLIDO*

📝 *Como usar:*
_"3 [campo] [novo valor]"_

*Exemplos:*
• \`3 tipo Crédito\`
• \`3 valor R$ 250,00\`
• \`3 pagamento Parcelado\`
• \`3 parcelas 6\`

━━━━━━━━━━━━━━━━
🔧 *Campos editáveis:*
${fieldsList}`;
  },

  createEditSuccessMessage(card: any): string {
    return `✅ *CAMPO ATUALIZADO*

${cardManagementService.formatCardInfo(card)}

━━━━━━━━━━━━━━━━
⚙️ *COMANDOS DISPONÍVEIS:*

*[1]* ✅ Confirmar comprovante
*[2]* ❌ Cancelar comprovante
*[3]* 🔧 Editar informações

_Digite apenas o número da opção desejada._`;
  },

  createCancelledCardMessage(cardId: string): string {
    return `🗑️ *COMPROVANTE CANCELADO*

🆔 *ID:* ${cardId.substring(0, 8)}...
📅 *Data:* ${new Date().toLocaleDateString('pt-BR')}

━━━━━━━━━━━━━━━━
_O comprovante foi removido e não será salvo no sistema._

📷 Envie uma nova imagem para processar outro comprovante.`;
  },

  createStatusMessage(stats: any, pendingCard: any): string {
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

    return statusText;
  }
};
