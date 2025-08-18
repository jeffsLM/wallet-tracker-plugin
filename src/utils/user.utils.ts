import { WhatsappSocket } from '../types';


export const userUtils = {
  async getSenderName(sock: WhatsappSocket, senderJid: string, groupJid: string): Promise<string> {
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
};
