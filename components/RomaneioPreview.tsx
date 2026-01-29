
import React from 'react';
import { RomaneioData } from '../types';
import { formatCurrency, formatDate } from '../utils';

interface RomaneioPreviewProps {
  data: RomaneioData;
  totals: { products: number, expenses: number, grand: number };
}

const RomaneioPreview: React.FC<RomaneioPreviewProps> = ({ data, totals }) => {
  const inferKind = (r?: Partial<RomaneioData> | null) => {
    const k = String((r as any)?.kind ?? '').trim().toUpperCase();
    if (k === 'COMPRA') return 'COMPRA';
    if (k === 'VENDA') return 'VENDA';
    const nature = String((r as any)?.natureOfOperation ?? '').trim().toUpperCase();
    if (nature.includes('COMPRA')) return 'COMPRA';
    return 'VENDA';
  };
  const kind = inferKind(data);
  const showBanking = kind !== 'COMPRA' || !!data.bankingEnabled;

  return (
    <div className="print-container bg-white w-[210mm] min-h-[297mm] shadow-2xl mx-auto text-black border border-gray-300">
      <div className="print-scale p-10 text-[11px] leading-tight text-black flex flex-col min-h-[297mm]">
        <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-2">
          <div className="flex-1">
            <h1 className="text-2xl font-black uppercase text-center w-full">{kind === 'COMPRA' ? 'Romaneio de Compra' : 'Romaneio de Venda'}</h1>
          </div>
          <div className="text-right whitespace-nowrap min-w-[120px]">
            <div className="flex justify-between">
              <span className="font-bold">Nº</span>
              <span className="text-red-600 font-bold text-sm">{data.number}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="font-bold">Emissão</span>
              <span>{formatDate(data.emissionDate)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="font-bold uppercase">{kind === 'COMPRA' ? 'Data de Compra' : 'Data de Venda'}</span>
              <span>{formatDate(data.saleDate)}</span>
            </div>
          </div>
        </div>

      {/* Dynamic Company Branding */}
      <div className="flex items-center mb-8 border border-gray-200 p-3 rounded">
        <div className="flex flex-col items-center min-w-[120px] mr-6">
          {data.company.logoUrl ? (
            <img 
              src={data.company.logoUrl} 
              alt="Logo Empresa" 
              className="max-w-[160px] max-h-[80px] object-contain"
            />
          ) : (
            <div className="w-40 h-16 bg-gray-50 border border-gray-200 border-dashed rounded flex items-center justify-center text-[8px] text-gray-400 italic">
               Logo não vinculada
            </div>
          )}
        </div>
        <div className="flex-1 text-[10px] leading-relaxed">
          <p className="font-black text-sm uppercase text-gray-900 mb-1">{data.company.name}</p>
          <p className="font-bold uppercase">{data.company.location}</p>
          <p className="uppercase">{data.company.address} - CEP {data.company.cep}</p>
          <p className="uppercase font-bold">TEL {data.company.tel}</p>
        </div>
      </div>

      {/* Client Information Grid */}
      <div className="grid grid-cols-2 gap-y-2 mb-6 border border-gray-300 p-3 rounded bg-gray-50/30">
        <div>
          <span className="font-bold uppercase">{kind === 'COMPRA' ? 'Produtor:' : 'Cliente:'}</span> {data.client.name}
        </div>
        <div>
          <span className="font-bold uppercase">CNPJ:</span> {data.client.cnpj}
        </div>
        <div>
          <span className="font-bold uppercase">Bairro:</span> {data.client.neighborhood}
        </div>
        <div>
          <span className="font-bold uppercase">IE:</span> {data.client.ie}
        </div>
        <div>
          <span className="font-bold uppercase">Municipio:</span> {data.client.city}
        </div>
        <div>
          <span className="font-bold uppercase">Logadouro:</span> {data.client.address}
        </div>
        <div>
          <span className="font-bold uppercase">Estado:</span> {data.client.state}
        </div>
      </div>

      {/* Operation Details */}
      <div className="grid grid-cols-2 gap-y-2 mb-6 border border-gray-300 p-3 rounded">
        <div className="flex items-center">
          <span className="font-bold uppercase mr-4">Natureza de Operação:</span>
          <span>{data.natureOfOperation}</span>
        </div>
        <div className="flex items-center">
          <span className="font-bold uppercase mr-4">Prazo/Condição:</span>
          <span>{data.terms}</span>
        </div>
        <div className="flex items-center">
          <span className="font-bold uppercase mr-4">Data de Venda:</span>
          <span>{formatDate(data.saleDate)}</span>
        </div>
        <div className="flex items-center">
          <span className="font-bold uppercase mr-4">Vencimento:</span>
          <span>{formatDate(data.dueDate)}</span>
        </div>
      </div>

      {/* Products Table */}
      <table className="w-full border-collapse mb-4">
        <thead>
          <tr className="bg-green-100/50 border-y border-black text-center font-bold">
            <th className="py-2 border-r border-black w-16">CÓDIGO</th>
            <th className="py-2 border-r border-black text-left px-2">DESCRIÇÃO</th>
            <th className="py-2 border-r border-black w-16">KG</th>
            <th className="py-2 border-r border-black w-24">QTD CX</th>
            <th className="py-2 border-r border-black w-32">VAL. UNIT</th>
            <th className="py-2 w-32">VALOR</th>
          </tr>
        </thead>
        <tbody>
          {data.products.map((p, idx) => (
            <tr key={p.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-200 text-center`}>
              <td className="py-1 border-r border-black">{p.code}</td>
              <td className="py-1 border-r border-black text-left px-2 uppercase">{p.description}</td>
              <td className="py-1 border-r border-black">{p.kg}</td>
              <td className="py-1 border-r border-black">{p.quantity}</td>
              <td className="py-1 border-r border-black text-right px-4">
                {formatCurrency(p.unitValue)}
              </td>
              <td className="py-1 text-right px-4 font-bold">
                {formatCurrency(p.quantity * p.unitValue)}
              </td>
            </tr>
          ))}
          {[...Array(Math.max(0, 5 - data.products.length))].map((_, i) => (
            <tr key={`empty-p-${i}`} className="border-b border-gray-200 h-6">
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Products Total Row */}
      <div className="flex justify-end mb-8">
        <div className="flex items-center justify-between bg-green-100/50 p-2 rounded-sm border border-black min-w-[300px]">
          <span className="font-bold uppercase">Total Produtos</span>
          <span className="text-lg font-black">{formatCurrency(totals.products)}</span>
        </div>
      </div>

      {/* Expenses Table */}
      <table className="w-full border-collapse mb-4">
        <thead>
          <tr className="bg-green-100/50 border-y border-black text-center font-bold">
            <th className="py-2 border-r border-black w-16">CÓDIGO</th>
            <th className="py-2 border-r border-black text-left px-2">DESCRIÇÃO DESPESAS</th>
            <th className="py-2 border-r border-black w-24">QTD</th>
            <th className="py-2 border-r border-black w-32">VAL. UNIT</th>
            <th className="py-2 w-32">VALOR</th>
          </tr>
        </thead>
        <tbody>
          {data.expenses.map((e, idx) => (
            <tr key={e.id} className="border-b border-gray-200 text-center">
              <td className="py-1 border-r border-black">{e.code}</td>
              <td className="py-1 border-r border-black text-left px-2 uppercase font-bold">{e.description}</td>
              <td className="py-1 border-r border-black">{e.quantity}</td>
              <td className="py-1 border-r border-black">{e.unitValue === '/' ? '/' : formatCurrency(parseFloat(e.unitValue) || 0)}</td>
              <td className="py-1 text-right px-4">
                {e.total === 0 ? 'R$ -' : formatCurrency(e.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mb-8">
        <div className="flex items-center justify-between bg-green-100/50 p-2 rounded-sm border border-black min-w-[300px]">
          <span className="font-bold uppercase">Total Despesas</span>
          <span className="text-lg font-black">{formatCurrency(totals.expenses)}</span>
        </div>
      </div>

      <div className="flex justify-end mb-8">
        <div className="flex items-center justify-between bg-green-200 p-3 rounded shadow-inner border-2 border-green-800 min-w-[400px]">
          <span className="font-black text-xl uppercase text-green-900">Total Geral</span>
          <span className="text-2xl font-black text-green-900">{formatCurrency(totals.grand)}</span>
        </div>
      </div>

      {/* Customer Observations Dynamic */}
      <div className="mb-8 p-3 border border-gray-400 bg-gray-50 rounded italic text-[9px] leading-tight">
        <h4 className="font-bold uppercase mb-1 underline">{kind === 'COMPRA' ? 'Observação ao Produtor' : 'Observação ao Cliente'}</h4>
        <div className="whitespace-pre-wrap">{data.observation}</div>
      </div>

      {showBanking && (
        <div className="mt-auto bg-green-50 p-4 border-2 border-green-200 rounded-lg">
          <h4 className="text-center font-black text-sm uppercase border-b border-green-800 mb-3 pb-1">Dados Bancários</h4>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <div className="flex justify-between">
              <span className="font-bold uppercase">Banco:</span>
              <span>{data.banking.bank}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold uppercase">Pix / CNPJ:</span>
              <span>{data.banking.pix}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold uppercase">Tipo de Conta:</span>
              <span>{data.banking.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold uppercase">Titular:</span>
              <span className="font-bold">{data.banking.owner}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold uppercase">Agência:</span>
              <span>{data.banking.agency}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold uppercase">Conta:</span>
              <span>{data.banking.account}</span>
            </div>
          </div>
        </div>
      )}

      <div className={`${showBanking ? 'mt-6' : 'mt-auto'} text-center border-t-2 border-black pt-2 relative`}>
        <p className="font-black uppercase text-xs tracking-widest">
          OBS: Após a realização do depósito enviar comprovantes ao vendedor responsável
        </p>
        <div className="print-footer-note absolute -bottom-6 right-0 text-[7px] text-gray-400 italic">
          Desenvolvido por VisionApp - Mateus Angelo vr 1.1.1
        </div>
      </div>
      </div>
    </div>
  );
};

export default RomaneioPreview;
