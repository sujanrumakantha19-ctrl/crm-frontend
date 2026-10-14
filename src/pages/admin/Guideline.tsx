import { useState, useMemo, type ReactNode } from 'react';
import { RotateCcw, HandCoins, Landmark } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

type CashInputs = {
  squareFeet: string;
  price: string;
  sellers: string;
  buyers: string;
};

type LoanInputs = CashInputs & {
  bankDD: string;
};

interface FieldDef {
  key: string;
  label: string;
  prefix?: string;
}

interface CalcResults {
  totalValue: number;
  chequeCount: number;
  eachCheque: number | null;
}

const EMPTY_CASH: CashInputs = { squareFeet: '', price: '', sellers: '', buyers: '' };
const EMPTY_LOAN: LoanInputs = { ...EMPTY_CASH, bankDD: '' };

const CASH_FIELDS: FieldDef[] = [
  { key: 'squareFeet', label: 'Square Feet' },
  { key: 'price', label: 'Price (₹ per sq. ft.)', prefix: '₹' },
  { key: 'sellers', label: 'No. of Sellers' },
  { key: 'buyers', label: 'No. of Buyers' },
];

const LOAN_FIELDS: FieldDef[] = [
  ...CASH_FIELDS,
  { key: 'bankDD', label: 'Bank DD (₹)', prefix: '₹' },
];

const toNumber = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const toNonNegativeNumber = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const toNonNegativeInteger = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const formatINR = (n: number): string =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const formatCount = (n: number): string => n.toLocaleString('en-IN');

const computeResults = (
  inputs: { squareFeet: string; price: string; sellers: string; buyers: string },
  bankDD = 0
): CalcResults => {
  const sqFt = toNonNegativeNumber(inputs.squareFeet);
  const price = toNonNegativeNumber(inputs.price);
  const sellers = toNonNegativeInteger(inputs.sellers);
  const buyers = toNonNegativeInteger(inputs.buyers);
  const validBankDD = Math.max(0, bankDD);

  const totalValue = sqFt * price;
  const chequeCount = (sellers > 0 && buyers > 0) ? sellers * buyers : 0;
  const base = Math.max(0, totalValue - validBankDD);
  const eachCheque = chequeCount > 0 && base > 0 ? base / chequeCount : null;
  return { totalValue, chequeCount, eachCheque };
};

function Field({
  label,
  prefix,
  value,
  onChange,
}: {
  label: string;
  prefix?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isCountField = label.includes('No.');

  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</span>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          min={0}
          step={isCountField ? 1 : 'any'}
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw.includes('-')) return;
            if (isCountField && raw.includes('.')) return;
            onChange(raw);
          }}
          placeholder="0"
          className={prefix ? 'pl-7' : ''}
        />
      </div>
    </label>
  );
}

function ResultsCard({ results }: { results: CalcResults }) {
  const rows = [
    { label: 'Total Value', value: formatINR(results.totalValue), highlight: true },
    { label: 'Total Cheque/RTGS', value: formatCount(results.chequeCount), highlight: false },
    {
      label: 'Each Cheque/RTGS Value',
      value: results.eachCheque === null ? '—' : formatINR(results.eachCheque),
      highlight: true,
    },
  ];

  return (
    <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Result</p>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-600">{r.label}</span>
            <span
              className={`text-sm font-bold ${
                r.highlight ? 'text-brand-blue text-base' : 'text-slate-900'
              }`}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalcPanel({
  title,
  subtitle,
  icon,
  fields,
  values,
  onFieldChange,
  results,
  onReset,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  fields: FieldDef[];
  values: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  results: CalcResults;
  onReset: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-brand-blue/10 text-brand-blue">{icon}</div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            prefix={f.prefix}
            value={values[f.key] || ''}
            onChange={(v) => onFieldChange(f.key, v)}
          />
        ))}
      </div>

      <ResultsCard results={results} />
    </div>
  );
}

export default function AdminGuideline() {
  const [activeTab, setActiveTab] = useState<'cash' | 'loan'>('cash');
  const [cash, setCash] = useState<CashInputs>(EMPTY_CASH);
  const [loan, setLoan] = useState<LoanInputs>(EMPTY_LOAN);

  const cashResults = useMemo(() => computeResults(cash), [cash]);
  const loanResults = useMemo(() => computeResults(loan, toNumber(loan.bankDD)), [loan]);

  const updateCash = (key: string, v: string) =>
    setCash((prev) => ({ ...prev, [key]: v }));
  const updateLoan = (key: string, v: string) =>
    setLoan((prev) => ({ ...prev, [key]: v }));

  return (
    <div className="space-y-6">
      <div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'cash' | 'loan')}>
        <TabsList>
          <TabsTrigger value="cash">Cash</TabsTrigger>
          <TabsTrigger value="loan">Loan</TabsTrigger>
        </TabsList>

        <TabsContent value="cash">
          <CalcPanel
            title="Cash Calculation"
            subtitle="Total value and cheque/RTGS split for cash deals"
            icon={<HandCoins size={18} />}
            fields={CASH_FIELDS}
            values={cash}
            onFieldChange={updateCash}
            results={cashResults}
            onReset={() => setCash(EMPTY_CASH)}
          />
        </TabsContent>

        <TabsContent value="loan">
          <CalcPanel
            title="Loan Calculation"
            subtitle="Total value and cheque/RTGS split with bank DD deduction"
            icon={<Landmark size={18} />}
            fields={LOAN_FIELDS}
            values={loan}
            onFieldChange={updateLoan}
            results={loanResults}
            onReset={() => setLoan(EMPTY_LOAN)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
