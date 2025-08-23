// cardAnalyzer.service.ts
import Fuse from 'fuse.js';

interface CardInfo {
  type: 'credito' | 'debito' | 'alimentacao' | 'voucher' | 'refeicao' | 'desconhecido';
  lastFourDigits: string;
  amount: string;
  installments: number;
  installmentText: string;
}

interface CardPattern {
  keywords: string[];
  type: 'credito' | 'debito' | 'alimentacao' | 'voucher' | 'refeicao' | 'desconhecido';
  weight: number; // Peso para priorizar certos padrões
}

// Padrões para identificação de tipos de cartão - organizados por prioridade
const cardPatterns: CardPattern[] = [
  // Padrões específicos para refeição (alta prioridade)
  {
    keywords: [
      'refeicao', 'refeição', 'refei cao', 'refei', 'vale refeicao', 'vale refeição',
      'ben', 'greencard', 'alelo refeicao', 'alelo refeição', 'ticket refeicao',
      'ticket refeição', 'sodexo refeicao', 'sodexo refeição'
    ],
    type: 'refeicao',
    weight: 3
  },
  // Padrões específicos para alimentação
  {
    keywords: [
      'alimentacao', 'alimentação', 'alimenta cao', 'alimenta', 'meal', 'aumentac',
      'vale alimentacao', 'vale alimentação', 'ticket alimentacao', 'ticket alimentação',
      'sodexo alimentacao', 'sodexo alimentação'
    ],
    type: 'alimentacao',
    weight: 3
  },
  // Padrões para crédito
  {
    keywords: [
      'credito', 'crédito', 'credit', 'parcelado', 'parcelas', 'vezes',
      'mastercard credit', 'visa credit', 'elo credit', 'amex',
      'american express', 'cartao credito', 'cartão crédito',
      'comprovante credito', 'conprovante credito'
    ],
    type: 'credito',
    weight: 2
  },
  // Padrões para débito
  {
    keywords: [
      'debito', 'débito', 'debit', 'conprovante debito',
      'mastercard debit', 'visa debit', 'elo debit', 'cartao debito',
      'cartão débito', 'senha digitada', 'comprovante debito',
    ],
    type: 'debito',
    weight: 2
  },
  // Padrões para voucher
  {
    keywords: [
      'voucher', 'vale', 'gift card', 'presente', 'cupom',
      'desconto', 'promocional', 'cortesia', 'venda a voucher',
      'venda à voucher'
    ],
    type: 'voucher',
    weight: 1
  }
];

/**
 * Analisa o texto OCR e extrai informações do cartão
 */
export function analyzeCardInfo(text: string): CardInfo {
  const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, ' ');

  // Identificar tipo do cartão
  const cardType = identifyCardType(normalizedText);

  // Extrair últimos 4 dígitos
  const lastFourDigits = extractLastFourDigits(text);

  // Extrair valor
  const amount = extractAmount(text);

  // Extrair parcelas
  const { installments, installmentText } = extractInstallments(text, cardType);

  return {
    type: cardType,
    lastFourDigits,
    amount,
    installments,
    installmentText
  };
}

function normalizeString(str: string) {
  return str
    .normalize('NFD') // decompõe caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // remove os acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Identifica o tipo do cartão usando múltiplas estratégias
 */
function identifyCardType(text: string): CardPattern['type'] {
  const normalizedText = normalizeString(text);

  const directMatch = findDirectKeywordMatch(normalizedText);
  console.log(`Direct match: ${directMatch}`);
  if (directMatch !== 'desconhecido') return directMatch;

  const fuzzyMatch = findFuzzyMatch(normalizedText);
  console.log(`Fuzzy match: ${fuzzyMatch}`);
  if (fuzzyMatch !== 'desconhecido') return fuzzyMatch;

  const fragmentMatch = findFragmentMatch(normalizedText);
  console.log(`Fragment match: ${fragmentMatch}`);
  if (fragmentMatch !== 'desconhecido') return fragmentMatch;

  return 'desconhecido';
}

/**
 * Busca direta por palavras-chave no texto
 */
function findDirectKeywordMatch(text: string): CardPattern['type'] {
  const typeScores: { [key in CardPattern['type']]: number } = {
    credito: 0,
    debito: 0,
    alimentacao: 0,
    refeicao: 0,
    voucher: 0,
    desconhecido: 0
  };

  for (const pattern of cardPatterns) {
    for (const keyword of pattern.keywords) {
      const normalizedKeyword = normalizeString(keyword);
      if (text.includes(normalizedKeyword)) {
        typeScores[pattern.type] += pattern.weight;
        console.log(`Palavra-chave encontrada: "${normalizedKeyword}" -> ${pattern.type} (+${pattern.weight})`);
      }
    }
  }

  const bestType = Object.entries(typeScores).reduce((a, b) =>
    a[1] > b[1] ? a : b
  );

  if (bestType[1] > 0) {
    return bestType[0] as CardPattern['type'];
  }

  return 'desconhecido';
}

/**
 * Busca fuzzy usando Fuse.js
 */
function findFuzzyMatch(text: string): CardPattern['type'] {
  const searchItems = cardPatterns.flatMap(pattern =>
    pattern.keywords.map(keyword => ({
      keyword: normalizeString(keyword),
      type: pattern.type,
      weight: pattern.weight
    }))
  );

  const fuse = new Fuse(searchItems, {
    includeScore: true,
    threshold: 0.3,
    distance: 50,
    minMatchCharLength: 4,
    keys: ['keyword']
  });

  const results = fuse.search(text);

  const typeScores: { [key in CardPattern['type']]: number } = {
    credito: 0,
    debito: 0,
    alimentacao: 0,
    refeicao: 0,
    voucher: 0,
    desconhecido: 0
  };

  for (const result of results) {
    const weight = (1 - (result.score ?? 0)) * result.item.weight;
    typeScores[result.item.type] += weight;
  }

  const bestType = Object.entries(typeScores).reduce((a, b) =>
    a[1] > b[1] ? a : b
  );

  if (bestType[1] > 0.5) {
    return bestType[0] as CardPattern['type'];
  }

  return 'desconhecido';
}

/**
 * Busca por fragmentos de palavras (para OCR com espaçamento irregular)
 */
function findFragmentMatch(text: string): CardPattern['type'] {
  const typeScores: { [key in CardPattern['type']]: number } = {
    credito: 0,
    debito: 0,
    alimentacao: 0,
    refeicao: 0,
    voucher: 0,
    desconhecido: 0
  };

  // Fragmentos específicos para cada tipo
  const fragments = [
    { patterns: ['refei', 'refeica', 'alelo', 'ben'], type: 'refeicao' as const, weight: 3 },
    { patterns: ['alimenta', 'meal', 'ticket', 'sodexo'], type: 'alimentacao' as const, weight: 3 },
    { patterns: ['credit', 'credito', 'parcel', 'vezes', 'cr dito'], type: 'credito' as const, weight: 1 },
    // { patterns: ['debit', 'debito', 'vista'], type: 'debito' as const, weight: 2 },
    { patterns: ['voucher', 'vale', 'cupom'], type: 'voucher' as const, weight: 1 }
  ];

  for (const fragment of fragments) {
    for (const pattern of fragment.patterns) {
      if (text.includes(pattern)) {
        typeScores[fragment.type] += fragment.weight;
      }
    }
  }

  const bestType = Object.entries(typeScores).reduce((a, b) =>
    a[1] > b[1] ? a : b
  );

  if (bestType[1] > 0) {
    return bestType[0] as CardPattern['type'];
  }

  return 'desconhecido';
}

/**
 * Extrai os últimos 4 dígitos do cartão
 */
function extractLastFourDigits(text: string): string {
  // Padrões mais específicos baseados no exemplo fornecido
  const patterns = [
    // Para o formato "alelo doc 645091" - pega os últimos 4 do número doc
    /alelo\s+doc\s+(\d+)/gi,
    /doc\s+(\d+)/gi,
    // Padrões tradicionais
    /\*{4,}\s*(\d{4})/g, // ****1234
    /\*{12,}\s*(\d{4})/g, // ************1234
    /final\s*(\d{4})/gi, // final 1234
    /terminado\s+em\s*(\d{4})/gi, // terminado em 1234
    /cartao\s*\*{4,}\s*(\d{4})/gi, // cartao ****1234
    /cartão\s*\*{4,}\s*(\d{4})/gi, // cartão ****1234
    // Padrões específicos do exemplo
    /[a-zA-Z]\s*(\d{4})\s*$/gm, // letra seguida de 4 dígitos no final (ex: "A 1029")
    /\b(\d{4})\b(?=\s*$|$)/gm, // 4 dígitos isolados no final de linhas
    /(\d{4})\s*$/gm // 4 dígitos no final de uma linha
  ];

  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length > 0) {
      const match = matches[matches.length - 1]; // Pega o último match
      if (match[1]) {
        // Para números maiores que 4 dígitos, pega os últimos 4
        const digits = match[1];
        return digits.length > 4 ? digits.slice(-4) : digits;
      }
    }
  }

  return '';
}

/**
 * Extrai o valor monetário
 */
function extractAmount(text: string): string {

  // Padrões mais específicos para o formato do exemplo
  const patterns = [
    // Para o formato "refeicao r 23 33" (valor pode estar separado)
    /refeicao\s+r\s+(\d+)\s+(\d{2})/gi,
    /alimentacao\s+r\s+(\d+)\s+(\d{2})/gi,
    // Padrões tradicionais
    /valor:\s*r\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi,
    /valor\s+da\s+\w+\s+r\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi,
    /valor\s+do\s+\w+\s+r\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi,
    /(?:total|valor|importo|amount)[\s:]*r\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi,
    /r\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi,
    /(\d{1,3}(?:\.\d{3})*,\d{2})\s*reais?/gi,
    /(\d{1,3}(?:\.\d{3})*,\d{2})(?=\s|$)/g,
    /(\d+,\d{1})(?!\d)/g
  ];

  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length > 0) {
      const match = matches[0];

      // Para padrões com dois grupos (reais e centavos separados)
      if (match[2]) {
        return `R$ ${match[1]},${match[2]}`;
      }

      // Para padrões tradicionais
      if (match[1]) {
        return `R$ ${match[1]}`;
      }
    }
  }

  return '';
}

/**
 * Extrai informações sobre parcelas
 */
function extractInstallments(text: string, cardType: string): { installments: number; installmentText: string } {
  const lowerText = text.toLowerCase();

  if (/\b(?:a\s*vista|à\s*vista|avista)\b/.test(lowerText)) {
    return { installments: 1, installmentText: '1x' };
  }

  // Para cartões que não são de crédito, sempre é à vista
  if (cardType !== 'credito') {
    return { installments: 1, installmentText: '1x' };
  }

  const patterns = [
    /(\d{1,2})\s*x\s*(?:de\s*)?r?\$?\d+/gi,  // 2x de R$20,00
    /(\d{1,2})\s*vezes/gi,                  // 3 vezes
    /(\d{1,2})\s*parcelas?/gi,              // 4 parcelas
    /parcelado\s+em\s+(\d{1,2})/gi          // parcelado em 5
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const installments = parseInt(match[1]);
      if (!isNaN(installments) && installments > 0) {
        return { installments, installmentText: `${installments}x` };
      }
    }
  }

  return { installments: 1, installmentText: '1x' };
}

/**
 * Formata as informações do cartão em texto legível
 */
export function formatCardInfo(cardInfo: CardInfo): string {
  const typeNames = {
    credito: 'Crédito',
    debito: 'Débito',
    alimentacao: 'Alimentação',
    voucher: 'Voucher',
    refeicao: 'Refeição',
    desconhecido: 'Desconhecido'
  };

  let result = `\n\n📱 Tipo: ${typeNames[cardInfo.type]}`;

  if (cardInfo.amount) {
    result += `\n💰 Valor: ${cardInfo.amount}`;
  }

  if (cardInfo.type === 'credito' || cardInfo.installments > 1) {
    result += `\n💳 Parcelas: ${cardInfo.installmentText}`;
  } else {
    result += `\n💳 Pagamento: À vista`;
  }

  return result;
}

export const stringAnalyzerService = {
  analyzeCardInfo,
  formatCardInfo
}
