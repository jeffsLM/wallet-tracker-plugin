const FIELD_COMMANDS = {
  'tipo': 'purchaseType',
  'valor': 'amount',
  'pagamento': 'payment',
  'parcelas': 'parcelas'
} as const;

interface EditCommand {
  field: string;
  value: string | number;
  updates: any;
}

export const commandParser = {
  parseEditCommand(text: string): EditCommand | null {
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
};
