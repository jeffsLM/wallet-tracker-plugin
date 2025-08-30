const FIELD_COMMANDS = {
  'tipo': 'purchaseType',
  'valor': 'amount',
  'parcelas': 'parcelas',
  'final': 'lastFourDigits'
} as const;

interface EditCommand {
  field: string;
  value: string | number;
  updates: Record<string, any>;
}

const fieldParsers: Record<string, (raw: string) => string | number | null> = {
  parcelas: (raw) => {
    const n = parseInt(raw.trim(), 10);
    return isNaN(n) ? null : n;
  },
  amount: (raw) => {
    if (!raw) return null;

    const normalized = raw.replace(/\s/g, '').replace(',', '.').replace(/\.(?=\d{3,})/g, '');

    const n = Number(normalized);
    if (isNaN(n)) return null;

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(n);
  },
  purchaseType: (raw) => raw.trim(),
  payment: (raw) => raw.trim()
};

export const commandParser = {
  parseEditCommand(text: string): EditCommand | null {
    const match = text.match(/(?:3|editar)\s+(\w+)\s+(.+)/i);
    if (!match) return null;

    const fieldKey = match[1].toLowerCase();
    const rawValue = match[2].trim();

    const field = FIELD_COMMANDS[fieldKey as keyof typeof FIELD_COMMANDS];
    if (!field) return null;

    const parser = fieldParsers[field];
    if (!parser) return null;

    const value = parser(rawValue);
    if (value === null) return null;

    return {
      field: fieldKey,
      value,
      updates: { [field]: value }
    };
  }
};
