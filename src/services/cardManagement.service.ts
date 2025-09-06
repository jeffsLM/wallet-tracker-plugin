import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { qstashService } from './qstash.service';

interface CardData {
  id: string;
  purchaseType: string;
  amount: string;
  parcelas: number;
  lastFourDigits: string;
  user: string;
  ocrText: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  payer: string;
}

interface PendingCard extends CardData {
  status: 'pending';
  senderJid: string;
  groupJid: string;
  filePath: string;
}

interface CardResult {
  success: boolean;
  card?: CardData;
  error?: string;
}

interface CardListResult {
  success: boolean;
  cards?: CardData[];
  total?: number;
  error?: string;
}

interface CardEditOptions {
  purchaseType?: string;
  amount?: string;
  parcelas?: number;
  lastFourDigits?: string;
  payer?: string;
}

// Configurations
const CARDS_CONFIG = {
  dataDir: path.join(process.cwd(), 'data'),
  pendingFile: 'pending_cards.json',
  confirmedFile: 'confirmed_cards.json',
  maxPendingHours: 24,
  editableFields: ['purchaseType', 'amount', 'parcelas'] as const
} as const;

// Internal storage
let pendingCards = new Map<string, PendingCard>();
let confirmedCards: CardData[] = [];

// Utility functions
function initializeDataDir(): void {
  if (!fs.existsSync(CARDS_CONFIG.dataDir)) {
    fs.mkdirSync(CARDS_CONFIG.dataDir, { recursive: true });
  }
}

function loadCardsFromDisk(): void {
  try {
    // Load pending cards
    const pendingPath = path.join(CARDS_CONFIG.dataDir, CARDS_CONFIG.pendingFile);
    if (fs.existsSync(pendingPath)) {
      const pendingData = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
      pendingCards = new Map();
      for (const card of pendingData) {
        pendingCards.set(card.id, card);
      }
      console.log(`📋 ${pendingCards.size} cartões pendentes carregados`);
    }

    // Load confirmed cards
    const confirmedPath = path.join(CARDS_CONFIG.dataDir, CARDS_CONFIG.confirmedFile);
    if (fs.existsSync(confirmedPath)) {
      confirmedCards = JSON.parse(fs.readFileSync(confirmedPath, 'utf8'));
      console.log(`✅ ${confirmedCards.length} cartões confirmados carregados`);
    }
  } catch (error) {
    console.error('❌ Erro ao carregar cartões do disco:', error);
  }
}

function saveCardsToDisk(): void {
  try {
    // Save pending cards
    const pendingPath = path.join(CARDS_CONFIG.dataDir, CARDS_CONFIG.pendingFile);
    const pendingArray = Array.from(pendingCards.values());
    fs.writeFileSync(pendingPath, JSON.stringify(pendingArray, null, 2));

    // Save confirmed cards
    const confirmedPath = path.join(CARDS_CONFIG.dataDir, CARDS_CONFIG.confirmedFile);
    fs.writeFileSync(confirmedPath, JSON.stringify(confirmedCards, null, 2));

    console.log(`💾 Cartões salvos: ${pendingArray.length} pendentes, ${confirmedCards.length} confirmados`);
  } catch (error) {
    console.error('❌ Erro ao salvar cartões:', error);
  }
}

// Main service functions
async function createPendingCard(data: {
  purchaseType: string;
  amount: string;
  parcelas: number;
  lastFourDigits: string;
  user: string;
  ocrText: string;
  senderJid: string;
  groupJid: string;
  filePath: string;
  payer: string;
}): Promise<CardResult> {
  try {
    const cardId = uuidv4();

    const pendingCard: PendingCard = {
      id: cardId,
      purchaseType: data.purchaseType,
      amount: data.amount,
      parcelas: data.parcelas,
      lastFourDigits: data.lastFourDigits,
      user: data.user,
      ocrText: data.ocrText,
      timestamp: Date.now(),
      status: 'pending',
      senderJid: data.senderJid,
      groupJid: data.groupJid,
      filePath: data.filePath,
      payer: data.payer
    };

    pendingCards.set(cardId, pendingCard);
    saveCardsToDisk();

    console.log(`📝 Novo cartão criado - ID: ${cardId.substring(0, 8)} - Usuário: ${data.user}`);

    return {
      success: true,
      card: pendingCard
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro ao criar cartão pendente:', errorMessage);

    return {
      success: false,
      error: errorMessage
    };
  }
}

function getPendingCardByUser(senderJid: string): PendingCard | null {
  for (const card of pendingCards.values()) {
    if (card.senderJid === senderJid) {
      return card;
    }
  }
  return null;
}

function getCardById(cardId: string): PendingCard | null {
  return pendingCards.get(cardId) || null;
}

async function editPendingCard(cardId: string, updates: CardEditOptions): Promise<CardResult> {
  try {
    const card = pendingCards.get(cardId);
    if (!card) {
      return {
        success: false,
        error: 'Cartão não encontrado'
      };
    }

    // Apply only editable fields
    if (updates.purchaseType !== undefined) {
      card.purchaseType = updates.purchaseType;
    }
    if (updates.amount !== undefined) {
      card.amount = updates.amount;
    }
    if (updates.parcelas !== undefined) {
      card.parcelas = updates.parcelas;
    }
    if (updates.payer !== undefined) {
      card.payer = updates.payer;
    }
    if (updates.lastFourDigits !== undefined) {
      card.lastFourDigits = updates.lastFourDigits;
    }

    pendingCards.set(cardId, card);
    saveCardsToDisk();

    console.log(`✏️ Cartão editado - ID: ${cardId.substring(0, 8)}`);

    return {
      success: true,
      card
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro ao editar cartão:', errorMessage);

    return {
      success: false,
      error: errorMessage
    };
  }
}

async function confirmCard(cardId: string): Promise<CardResult> {
  try {
    const pendingCard = pendingCards.get(cardId);
    if (!pendingCard) {
      return {
        success: false,
        error: 'Cartão pendente não encontrado'
      };
    }

    const hasNumber = /\d/.test(pendingCard?.amount);

    if (!hasNumber) return {
      success: false,
      error: 'Valor do cartão não identificado, edite antes de confirmar'
    };
    const hasPurchaseTypes = ['credito', 'debito', 'alimentacao', 'voucher', 'refeicao'].includes(pendingCard.purchaseType);

    // Convert to confirmed card
    const confirmedCard: CardData = {
      id: pendingCard.id,
      purchaseType: !hasPurchaseTypes ? 'CREDITO' : pendingCard.purchaseType.toUpperCase(),
      amount: pendingCard.amount,
      parcelas: pendingCard.parcelas > 12 ? 12 : pendingCard.parcelas,
      lastFourDigits: pendingCard.lastFourDigits,
      user: pendingCard.user,
      ocrText: pendingCard.ocrText,
      timestamp: pendingCard.timestamp,
      payer: pendingCard.payer,
      status: 'confirmed'
    };

    // Remove from pending and add to confirmed
    pendingCards.delete(cardId);
    confirmedCards.push(confirmedCard);

    await qstashService.sendMessage({
      ...confirmedCard,
      status: confirmedCard.status.toUpperCase()
    });

    saveCardsToDisk();
    console.log(`✅ Cartão confirmado - ID: ${cardId.substring(0, 8)} - Usuário: ${confirmedCard.user}`);

    return {
      success: true,
      card: confirmedCard
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro ao confirmar cartão:', errorMessage);

    return {
      success: false,
      error: errorMessage
    };
  }
}

async function cancelCard(cardId: string): Promise<CardResult> {
  try {
    const card = pendingCards.get(cardId);
    if (!card) {
      return {
        success: false,
        error: 'Cartão não encontrado'
      };
    }

    pendingCards.delete(cardId);
    saveCardsToDisk();

    console.log(`❌ Cartão cancelado - ID: ${cardId.substring(0, 8)}`);

    return {
      success: true,
      card
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    return {
      success: false,
      error: errorMessage
    };
  }
}

function getConfirmedCards(): CardListResult {
  try {
    return {
      success: true,
      cards: [...confirmedCards],
      total: confirmedCards.length
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    return {
      success: false,
      error: errorMessage
    };
  }
}

function getPendingCards(): CardListResult {
  try {
    const cards = Array.from(pendingCards.values());
    return {
      success: true,
      cards,
      total: cards.length
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    return {
      success: false,
      error: errorMessage
    };
  }
}

function getCardsByUser(usuario: string): CardListResult {
  try {
    const userCards = confirmedCards.filter(card =>
      card.user.toLowerCase().includes(usuario.toLowerCase())
    );

    return {
      success: true,
      cards: userCards,
      total: userCards.length
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    return {
      success: false,
      error: errorMessage
    };
  }
}

function cleanupExpiredCards(): void {
  try {
    const cutoffTime = Date.now() - (CARDS_CONFIG.maxPendingHours * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [id, card] of pendingCards.entries()) {
      if (card.timestamp < cutoffTime) {
        pendingCards.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      saveCardsToDisk();
      console.log(`🧹 ${removedCount} cartões expirados removidos`);
    }
  } catch (error) {
    console.error('❌ Erro na limpeza de cartões:', error);
  }
}

function formatCardInfo(card: CardData | PendingCard): string {
  return `
💰 Valor: ${card.amount}
💳 Pagamento: ${card.purchaseType.toUpperCase()}
🔢 Parcelas: ${card.parcelas}
💳 Final cartão usado: ${card.lastFourDigits}
📝 Status: ${card.status === 'pending' ? '🟡 Pendente' : '✅ Confirmado'}
  `.trim();
}

function getStats(): {
  pending: number;
  confirmed: number;
  totalValue: number;
  users: number;
} {
  const totalValue = confirmedCards.reduce((sum, card) => {
    const value = parseFloat(card.amount.replace(/[^\d,.-]/g, '').replace(',', '.'));
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  const uniqueUsers = new Set(confirmedCards.map(card => card.user)).size;

  return {
    pending: pendingCards.size,
    confirmed: confirmedCards.length,
    totalValue,
    users: uniqueUsers
  };
}

// Initialize on module load
initializeDataDir();
loadCardsFromDisk();

// Auto-cleanup every hour
setInterval(() => {
  cleanupExpiredCards();
}, 60 * 60 * 1000);

export const cardManagementService = {
  createPendingCard,
  getPendingCardByUser,
  getCardById,
  editPendingCard,
  confirmCard,
  cancelCard,
  getConfirmedCards,
  getPendingCards,
  getCardsByUser,
  cleanupExpiredCards,
  formatCardInfo,
  getStats
};

export { CardData, PendingCard, CardResult, CardListResult, CardEditOptions };
export const EDITABLE_FIELDS = CARDS_CONFIG.editableFields;
