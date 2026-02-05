
import { RomaneioData } from './types';
import { toLocalDateInput } from './utils';

export const DEFAULT_OBSERVATION = `Atenção: Durante o recebimento desta carga, favor conferir este romaneio de compra.
1-Em caso de conformidade deve-se datar, assinar e devolver via e-mail.
2-Em caso de não conformidade, favor contactar com o vendedor e/ ou administração.
3-Em caso de nenhuma alternativa acima, consideramos aceita e referida o romaneio em todos os seus termos.
Nota 1: Para pagamentos com cheques, os mesmos deverão ser enviados no minimo 15 dias antes do vencimento, identificando a referida carga.
Nota 2: Em caso de depósito em conta, enviar via Whatsapp ou e-mail o comprovante de deposito referindo-se ao romaneio.`;

export const DEFAULT_ROMANEIO: RomaneioData = {
  id: "",
  kind: "VENDA",
  companyId: "",
  customerId: "",
  number: "",
  status: "PENDENTE",
  emissionDate: toLocalDateInput(),
  saleDate: toLocalDateInput(),
  dueDate: "",
  paymentStatus: "",
  paymentDate: "",
  natureOfOperation: "VENDA",
  terms: "30 DIAS",
  observation: DEFAULT_OBSERVATION,
  observationEnabled: true,
  company: {
    id: "",
    name: "CARGACERTA LOGÍSTICA E DISTRIBUIÇÃO",
    cnpj: "",
    ie: "",
    location: "MATRIZ",
    address: "AV. COMERCIAL, S/N - CENTRO",
    cep: "47600-000",
    tel: "(77) 99999-9999",
    logoUrl: "",
    banking: {
      bank: "BANCO EXEMPLO S.A",
      pix: "00.000.000/0001-00",
      type: "CORRENTE",
      agency: "0001",
      account: "00000-0",
      owner: "CARGACERTA LTDA"
    }
  },
  client: {
    name: "",
    cnpj: "",
    neighborhood: "",
    ie: "/",
    city: "",
    address: "",
    state: ""
  },
  products: [
    { id: '1', code: '1', description: 'PRODUTO EXEMPLO', kg: 1, quantity: 0, unitValue: 0 }
  ],
  expenses: [
    { id: 'e1', code: '684', description: 'SEGURO CARGA', quantity: '', unitValue: '', total: 0 },
    { id: 'e2', code: '745', description: 'BALDEIO', quantity: '', unitValue: '', total: 0 },
    { id: 'e3', code: '544', description: 'CAIXA MADEIRA', quantity: '', unitValue: '', total: 0 },
    { id: 'e4', code: '692', description: 'PAPELÕES', quantity: '', unitValue: '', total: 0 },
    { id: 'e5', code: '701', description: 'OUTRAS', quantity: '', unitValue: '', total: 0 }
  ],
  bankingEnabled: true,
  banking: {
    bank: "BANCO EXEMPLO S.A",
    pix: "00.000.000/0001-00",
    type: "CORRENTE",
    agency: "0001",
    account: "00000-0",
    owner: "CARGACERTA LTDA"
  }
};
