
export type RomaneioStatus = 'PENDENTE' | 'CONCLUÍDO' | 'CANCELADO';

export interface CompanyInfo {
  id: string;
  created_at?: string;
  name: string;
  location: string;
  address: string;
  cep: string;
  tel: string;
  logoUrl?: string;
  banking: BankingInfo;
}

export interface BankingInfo {
  bank: string;
  pix: string;
  type: string;
  agency: string;
  account: string;
  owner: string;
}

export interface Customer {
  id: string;
  name: string;
  cnpj: string;
  neighborhood: string;
  ie: string;
  city: string;
  address: string;
  state: string;
}

export interface ProductStock {
  id: string;
  code: string;
  description: string;
  kg: number;
  defaultUnitValue: number;
}

export interface ExpenseStock {
  id: string;
  created_at?: string;
  code: string;
  description: string;
  defaultUnitValue?: number;
}

export interface Observation {
  id: string;
  created_at?: string;
  title: string;
  content: string;
}

export interface CatalogProduct {
  id: number;
  created_at?: string;
  name: string;
  description?: string | null;
  price?: number | null;
  unit?: string | null;
}

export interface Product {
  id: string;
  code: string;
  description: string;
  kg: number;
  quantity: number;
  unitValue: number;
}

export interface Expense {
  id: string;
  code: string;
  description: string;
  quantity: string;
  unitValue: string;
  total: number;
}

export interface RomaneioData {
  id: string;
  created_at?: string;
  number: string;
  emissionDate: string;
  saleDate: string;
  dueDate: string;
  natureOfOperation: string;
  terms: string;
  status: RomaneioStatus;
  companyId?: string;
  customerId?: string;
  company_id?: string;
  customer_id?: string;
  observation: string;
  company: CompanyInfo;
  customer?: Customer;
  client: {
    name: string;
    cnpj: string;
    neighborhood: string;
    ie: string;
    city: string;
    address: string;
    state: string;
  };
  banking: BankingInfo;
  products: Product[];
  expenses: Expense[];
}
