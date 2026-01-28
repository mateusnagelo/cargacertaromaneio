
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

export const toLocalDateInput = (date: Date = new Date()): string => {
  const d = date instanceof Date ? date : new Date(date as any);
  const t = d.getTime();
  if (!Number.isFinite(t)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const calculateProductTotal = (quantity: number, unitValue: number): number => {
  return quantity * unitValue;
};
