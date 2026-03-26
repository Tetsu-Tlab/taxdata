import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  CreditCard,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  ChevronRight,
  Cloud,
  CheckCircle2,
  RefreshCw,
  FolderOpen,
  Zap,
  Archive,
  History,
  FileCheck,
  Sparkles,
  Check,
  X,
  Clock,
  ArrowRight,
  PencilLine,
  Trash2,
  Eye,
  FileText,
  BookOpen,
  AlertCircle
} from 'lucide-react';

// --- Data Types ---
interface Transaction {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  category: string; 
  type: 'income' | 'expense';
  source: string;
}

interface PendingFile {
  id: string;
  fileName: string;
  source: string;
  suggestedDate: string;
  suggestedVendor: string;
  suggestedAmount: number;
  suggestedCategory: string;
  confidence: number;
  status: 'scanning' | 'ready' | 'approved';
}

interface HistoricalPeriod {
  id: number;
  label: string;
  date: string;
  revenue: number;
  profit: number;
  status: '確定済' | '準備中';
}

interface ManualForm {
  date: string;
  vendor: string;
  amount: string;
  category: string;
  type: 'income' | 'expense';
  source: string;
}

interface BsData {
  // 資産
  cash: number;
  receivables: number;
  otherCurrentAssets: number;
  equipment: number;
  // 負債
  payables: number;
  taxPayable: number;
  otherLiabilities: number;
  // 純資産
  capital: number;
  retainedEarnings: number;
}

const CATEGORIES = [
  '売上高', '受取利息', '雑収入',
  '研究開発費', '支払手数料', '通信費', '広告宣伝費',
  '外注費', '消耗品費', '旅費交通費', '地代家賃', '保険料', '雑費'
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveSuccess, setShowArchiveSuccess] = useState(false);

  // --- AI Processing States ---
  const [isScanning, setIsScanning] = useState(false);
  const [manualForm, setManualForm] = useState<ManualForm>({
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    amount: '',
    category: '通信費',
    type: 'expense',
    source: '手動入力'
  });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [showAiSuccess, setShowAiSuccess] = useState(false);

  // --- 期間計算ロジック (テツさんの特別ルール) ---
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const displayPeriod = useMemo(() => {
    const baseYear = 2024;
    return currentMonth >= 4 ? (currentYear - baseYear + 1) : (currentYear - 1 - baseYear + 1);
  }, [currentYear, currentMonth]);

  const fiscalPeriod = useMemo(() => {
    const baseYear = 2024;
    return currentMonth >= 2 ? (currentYear - baseYear + 1) : (currentYear - 1 - baseYear + 1);
  }, [currentYear, currentMonth]);

  // メイン台帳の仕訳データ
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: '1', date: '2026-03-20', vendor: 'Minecraft Realms', amount: 1540, category: '研究開発費', type: 'expense', source: 'Minecraft' },
    { id: '2', date: '2026-03-22', vendor: 'OpenAI (ChatGPT)', amount: 3000, category: '支払手数料', type: 'expense', source: 'T-Lab' },
    { id: '3', date: '2026-03-24', vendor: 'Anthropic (Claude)', amount: 3200, category: '支払手数料', type: 'expense', source: 'T-Lab' },
    { id: '4', date: '2026-03-25', vendor: 'クライアントA', amount: 250000, category: '売上高', type: 'income', source: 'Bank' },
    { id: '5', date: '2026-03-26', vendor: 'AWS', amount: 12000, category: '通信費', type: 'expense', source: 'System' },
  ]);

  // 過去の決算データ
  const [historicalData, setHistoricalData] = useState<HistoricalPeriod[]>([
    { id: 1, label: '第1期', date: '2025年1月31日締', revenue: 1850000, profit: 450000, status: '確定済' },
  ]);

  // 今期 (P/L) 計算
  const plData = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { income, expense, profit: income - expense };
  }, [transactions]);

  // B/S データ
  const [bsData, setBsData] = useState<BsData>({
    cash: 500000,
    receivables: 250000,
    otherCurrentAssets: 0,
    equipment: 150000,
    payables: 30000,
    taxPayable: 0,
    otherLiabilities: 0,
    capital: 100000,
    retainedEarnings: 450000,
  });
  const [bsEditMode, setBsEditMode] = useState(false);

  const bsTotals = useMemo(() => {
    const totalCurrentAssets = bsData.cash + bsData.receivables + bsData.otherCurrentAssets;
    const totalFixedAssets = bsData.equipment;
    const totalAssets = totalCurrentAssets + totalFixedAssets;
    const totalLiabilities = bsData.payables + bsData.taxPayable + bsData.otherLiabilities;
    const totalEquity = bsData.capital + bsData.retainedEarnings + plData.profit;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    return { totalCurrentAssets, totalFixedAssets, totalAssets, totalLiabilities, totalEquity, totalLiabilitiesAndEquity };
  }, [bsData, plData.profit]);

  // --- AI Auto-Processing Actions ---
  const scanForNewFiles = () => {
    setIsScanning(true);
    // Googleドライブをスキャンして未処理ファイルを見つけるシミュレーション
    setTimeout(() => {
      const foundFiles: PendingFile[] = [
        { 
          id: Date.now().toString(), 
          fileName: 'Server_Monthly_Invoice_03.pdf', 
          source: 'System', 
          suggestedDate: '2026-03-27', 
          suggestedVendor: 'AWS Cloud Services', 
          suggestedAmount: 15800, 
          suggestedCategory: '通信費', 
          confidence: 0.96, 
          status: 'ready' 
        },
        { 
          id: (Date.now() + 1).toString(), 
          fileName: 'Minecraft_Skin_Pack_Ref.jpg', 
          source: 'Minecraft', 
          suggestedDate: '2026-03-28', 
          suggestedVendor: 'Mojang / Microsoft', 
          suggestedAmount: 800, 
          suggestedCategory: '研究開発費', 
          confidence: 0.88, 
          status: 'ready' 
        },
        { 
          id: (Date.now() + 2).toString(), 
          fileName: 'Claude_Pro_Subscription.pdf', 
          source: 'T-Lab', 
          suggestedDate: '2026-03-26', 
          suggestedVendor: 'Anthropic AI', 
          suggestedAmount: 3000, 
          suggestedCategory: '支払手数料', 
          confidence: 0.99, 
          status: 'ready' 
        }
      ];
      setPendingFiles(prev => [...foundFiles, ...prev]);
      setIsScanning(false);
      setActiveTab('auto');
    }, 2800);
  };

  const approveTransaction = (file: PendingFile) => {
    const newTx: Transaction = {
      id: file.id,
      date: file.suggestedDate,
      vendor: file.suggestedVendor,
      amount: file.suggestedAmount,
      category: file.suggestedCategory,
      type: 'expense',
      source: file.source
    };
    setTransactions(prev => [...prev, newTx]);
    setPendingFiles(prev => prev.filter(f => f.id !== file.id));
    setShowAiSuccess(true);
    setTimeout(() => setShowAiSuccess(false), 3000);
  };

  const approveAll = () => {
    const newTxs = pendingFiles.map(f => ({
      id: f.id,
      date: f.suggestedDate,
      vendor: f.suggestedVendor,
      amount: f.suggestedAmount,
      category: f.suggestedCategory,
      type: 'expense' as const,
      source: f.source
    }));
    setTransactions(prev => [...prev, ...newTxs]);
    setPendingFiles([]);
    setShowAiSuccess(true);
    setTimeout(() => setShowAiSuccess(false), 3000);
  };

  // --- Auth & Generic Actions ---
  useEffect(() => {
    const auth = localStorage.getItem('supportia_auth');
    if (auth === 'true') setIsAuthorized(true);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'supportia2026') {
      setIsAuthorized(true);
      localStorage.setItem('supportia_auth', 'true');
      setError(false);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  const syncFolders = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 2400);
  };

  const addManualTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.vendor || !manualForm.amount) return;
    const newTx: Transaction = {
      id: Date.now().toString(),
      date: manualForm.date,
      vendor: manualForm.vendor,
      amount: parseInt(manualForm.amount.replace(/,/g, ''), 10),
      category: manualForm.category,
      type: manualForm.type,
      source: manualForm.source || '手動入力'
    };
    setTransactions(prev => [newTx, ...prev]);
    setManualForm(prev => ({ ...prev, vendor: '', amount: '' }));
    setFormSubmitted(true);
    setTimeout(() => setFormSubmitted(false), 2000);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleArchive = () => {
    setIsArchiving(true);
    setTimeout(() => {
      setIsArchiving(false);
      setShowArchiveSuccess(true);
      setHistoricalData(prev => [
        ...prev, 
        { id: displayPeriod, label: `第${displayPeriod}期`, date: `${currentYear}年1月31日締`, revenue: 2100000, profit: 890000, status: '確定済' }
      ]);
      setTimeout(() => setShowArchiveSuccess(false), 4000);
    }, 3000);
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-10 rounded-[40px] shadow-2xl text-center">
            <div className="w-20 h-20 bg-teal-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-teal-500/30">
              <Lock className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Supportia Guard</h1>
            <p className="text-slate-400 mb-8 font-medium italic">大切な財務データを守る合言葉を入力 🔐</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワードを入力" className={`w-full bg-white/5 border ${error ? 'border-rose-500' : 'border-white/10'} rounded-2xl py-4 px-6 text-white text-center outline-none focus:border-teal-500/50 transition-all font-bold tracking-widest`}/>
              <button type="submit" className="w-full bg-teal-500 hover:bg-teal-400 text-slate-900 py-4 rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 group">ダッシュボードに入る <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" /></button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-teal-100 animate-in fade-in duration-700">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-100"><TrendingUp className="text-white" size={24} /></div>
            <h1 className="text-xl font-black tracking-tighter text-slate-800">Supportia</h1>
          </div>
          <nav className="space-y-1">
            <NavItem icon={<BarChart3 size={20} />} label="ダッシュボード" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <NavItem icon={<FileText size={20} />} label="ドキュメント" active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} />
            <div className="relative">
              <NavItem icon={<Zap size={20} />} label="AI自動処理" active={activeTab === 'auto'} onClick={() => setActiveTab('auto')} />
              {pendingFiles.length > 0 && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                  {pendingFiles.length}
                </span>
              )}
            </div>
            <NavItem icon={<CreditCard size={20} />} label="取引一覧" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
            <NavItem icon={<PieChart size={20} />} label="分析・決算" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
          </nav>
          <div className="absolute bottom-10 left-6 right-6 space-y-2">
             <button onClick={() => { localStorage.removeItem('supportia_auth'); setIsAuthorized(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all group">
               <Lock size={20} className="group-hover:text-rose-500" /><span className="font-semibold text-sm">ログアウト</span>
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-64 pr-8 pt-6 pb-20">
        <Header onSync={syncFolders} isSyncing={isSyncing} onScan={scanForNewFiles} isScanning={isScanning} />
        {showArchiveSuccess && <ArchiveSuccessToast />}
        {showAiSuccess && <AiSuccessToast />}

        {activeTab === 'dashboard' ? (
          <>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title={`第${fiscalPeriod}期 総売上`} amount={`¥${plData.income.toLocaleString()}`} trend="+12.5%" isPositive={true} icon={<ArrowUpRight className="text-teal-600" size={16} />} />
              <StatCard title={`第${fiscalPeriod}期 総支出`} amount={`¥${plData.expense.toLocaleString()}`} trend="-2.4%" isPositive={false} icon={<ArrowDownRight className="text-rose-600" size={16} />} />
              <StatCard title={`第${fiscalPeriod}期 予測利益`} amount={`¥${plData.profit.toLocaleString()}`} trend="+8.1%" isPositive={true} icon={<TrendingUp className="text-indigo-600" size={16} />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-10">
              <div className="lg:col-span-2 space-y-8">
                 {/* Pending AI Action Card */}
                 {pendingFiles.length > 0 && (
                   <section className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
                     <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                           <div className="w-16 h-16 bg-teal-400/20 rounded-2xl flex items-center justify-center border border-teal-400/30">
                              <Sparkles className="text-teal-400" size={32} />
                           </div>
                           <div>
                              <h3 className="text-xl font-black tracking-tight">AIが未承認の取引を {pendingFiles.length} 件見つけました</h3>
                              <p className="text-slate-400 text-sm mt-1 font-medium">内容を確認して、ワンタップで仕分けを承認しましょう！🚀</p>
                           </div>
                        </div>
                        <button onClick={() => setActiveTab('auto')} className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-6 py-4 rounded-2xl font-black text-sm transition-all active:scale-95 flex items-center gap-2 group">
                           今すぐ確認する <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                        </button>
                     </div>
                     <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
                   </section>
                 )}

                 {/* Recent Logs */}
                 <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h2 className="text-xl font-bold text-slate-800">最新の仕分けログ</h2>
                        <p className="text-sm text-slate-500 mt-1 italic tracking-tight font-medium">✨ AI秘書が正確に処理しました。</p>
                      </div>
                      <button onClick={() => setActiveTab('transactions')} className="text-xs font-black text-teal-600 hover:underline">すべて見る</button>
                    </div>
                    <div className="space-y-6">
                      {transactions.slice(-4).reverse().map(t => (
                        <ProcessingItem key={t.id} name={`${t.vendor} 明細.pdf`} category={t.category} amount={`¥${t.amount.toLocaleString()}`} source={t.source} />
                      ))}
                    </div>
                 </section>
              </div>

              <div className="space-y-6">
                 {/* Sources Card */}
                 <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm h-fit">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 underline decoration-teal-500/30"><Cloud size={16}/> クラウド同期先</h3>
                    <div className="space-y-3">
                       <FolderSource name="Minecraft 支出" url="https://drive.google.com/drive/folders/1hzU-s2JwU5LC8R56vUCO06RjOx0wbqax" status="監視中" color="bg-teal-500" />
                       <FolderSource name="T-Lab 支出" url="https://drive.google.com/drive/folders/1TNWNzIGTnqXYv66nJpRoOHhndgkN3SDu" status="監視中" color="bg-indigo-500" />
                    </div>
                 </div>

                 {/* Archive Card */}
                 <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm border-l-8 border-l-amber-400">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 outline outline-4 outline-amber-50">
                        <Archive size={24} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 tracking-tight">決算アーカイブ 🕰️✨</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5 tracking-tight font-black uppercase font-mono">
                          Prep for March 31
                        </p>
                      </div>
                    </div>
                    <p className="text-[12px] text-slate-600 mb-6 leading-relaxed font-bold italic">
                      「{currentYear}年3月31日までに第{displayPeriod}期の納税完了。第{displayPeriod}期の要件が確定しました。」
                    </p>
                    <button onClick={handleArchive} disabled={isArchiving} className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${isArchiving ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 text-white hover:bg-slate-700 shadow-xl shadow-slate-200'}`}>
                      {isArchiving ? <RefreshCw className="animate-spin" /> : <FileCheck size={20} className="text-amber-400" />}
                      {isArchiving ? 'アーカイブ作成中...' : `第${displayPeriod}期 データを永久保存`}
                    </button>
                    <p className="mt-4 text-[9px] text-slate-400 font-black text-center uppercase tracking-[0.2em]">Next cycle starts Apr 1</p>
                 </section>
              </div>
            </div>
          </>
        ) : activeTab === 'auto' ? (
          <div className="mt-8 space-y-8 animate-in slide-in-from-bottom-6 duration-500">
             <div className="flex items-center justify-between">
                <div>
                   <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3"><Zap className="text-teal-500" fill="currentColor"/> AI自動仕分け待合室</h2>
                   <p className="text-slate-500 mt-1 font-bold italic">クラウドから新しい領収書を拾ってきました。承認して帳簿に反映しましょう！✨</p>
                </div>
                {pendingFiles.length > 0 && (
                  <button onClick={approveAll} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-800 shadow-xl transition-all active:scale-95 flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-teal-400"/> すべて一括で承認 🚀
                  </button>
                )}
             </div>

             {pendingFiles.length === 0 ? (
               <div className="bg-white p-20 rounded-[50px] border border-slate-100 shadow-sm text-center">
                  <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-teal-100">
                     <CheckCircle2 className="text-teal-500" size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">現在、処理待ちのファイルはありません。</h3>
                  <p className="text-slate-400 max-w-md mx-auto mt-4 font-medium italic">すべて完璧に仕分けされています！新しい領収書をGoogleドライブに入れれば、AIがここに自動で表示します。</p>
                  <button onClick={scanForNewFiles} disabled={isScanning} className="mt-10 bg-white border-2 border-slate-200 px-8 py-4 rounded-2xl font-black text-slate-700 hover:bg-teal-50 hover:border-teal-500 hover:text-teal-600 transition-all active:scale-95 flex items-center gap-2 mx-auto disabled:opacity-50">
                     <RefreshCw size={20} className={isScanning ? 'animate-spin' : ''}/> {isScanning ? 'ドライブ巡回中...' : '今すぐドライブを巡回する'}
                  </button>
               </div>
             ) : (
               <div className="grid grid-cols-1 gap-6">
                  {pendingFiles.map(file => (
                    <div key={file.id} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm group hover:border-teal-500/50 hover:shadow-2xl transition-all relative overflow-hidden">
                       <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
                          {/* File Details */}
                          <div className="flex items-center gap-6 flex-1 min-w-0">
                             <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-500 transition-all shrink-0">
                                <FileText size={32} />
                             </div>
                             <div className="min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                   <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded uppercase tracking-widest">{file.source}</span>
                                   <h4 className="font-bold text-slate-800 tracking-tight truncate max-w-[200px]">{file.fileName}</h4>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-bold text-slate-400 italic">
                                   <span className="flex items-center gap-1"><Clock size={12}/> {file.suggestedDate}</span>
                                   <span className="flex items-center gap-1"><Eye size={12}/> AIが解析完了</span>
                                </div>
                             </div>
                          </div>

                          {/* AI Suggestion */}
                          <div className="flex-1 flex flex-col md:flex-row items-center gap-8 justify-center min-w-0">
                             <div className="text-center md:text-left min-w-[120px]">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">取引先</p>
                                <p className="font-black text-slate-800 truncate">{file.suggestedVendor}</p>
                             </div>
                             <div className="text-center md:text-left min-w-[100px]">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">金額</p>
                                <p className="font-black text-slate-800 text-lg italic">¥{file.suggestedAmount.toLocaleString()}</p>
                             </div>
                             <div className="text-center md:text-left min-w-[140px]">
                                <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest mb-1 flex items-center gap-1 justify-center md:justify-start">AI提案の科目 <Sparkles size={10}/></p>
                                <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-xs font-black border border-teal-100 inline-block">{file.suggestedCategory}</span>
                             </div>
                          </div>

                          {/* Confidence & Actions */}
                          <div className="flex items-center gap-6 shrink-0">
                             <div className="text-right hidden sm:block">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">確信度</p>
                                <div className="flex items-center gap-2">
                                   <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-teal-500" style={{ width: `${file.confidence * 100}%` }}></div></div>
                                   <span className="text-[10px] font-black text-teal-600">{Math.round(file.confidence * 100)}%</span>
                                </div>
                             </div>
                             <div className="flex items-center gap-2">
                                <button className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-all active:scale-90"><X size={20} /></button>
                                <button onClick={() => approveTransaction(file)} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-lg group">
                                   仕分け承認 <Check size={18} className="text-teal-400 group-hover:scale-125 transition-transform" />
                                </button>
                             </div>
                          </div>
                       </div>
                       <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 blur-[40px] rounded-full translate-x-1/2 -translate-y-1/2 "></div>
                    </div>
                  ))}
               </div>
             )}
          </div>
        ) : activeTab === 'analytics' ? (
          <div className="mt-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
               <h3 className="text-2xl font-black text-slate-800">決算・アーカイブ分析</h3>
               <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest italic decoration-teal-500/10 underline"><History size={14}/> 第{fiscalPeriod}期 会計データ反映中</div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white p-10 rounded-[50px] border border-slate-200 shadow-sm border-t-[12px] border-t-teal-500 h-full">
                  <div className="flex items-center gap-3 mb-10">
                    <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600 border border-teal-100 shadow-inner"><BarChart3 size={24}/></div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">第{fiscalPeriod}期 損益計算書 (P/L)</h3>
                  </div>
                  <div className="space-y-4">
                    <PLRow label="1. 売上高" amount={`¥${plData.income.toLocaleString()}`} bold />
                    <PLRow label="2. 売上原価" amount="¥0" />
                    <div className="h-px bg-slate-100 my-6" />
                    <PLRow label="売上総利益" amount={`¥${plData.income.toLocaleString()}`} highlight />
                    <div className="pt-6 pb-2"><span className="text-[10px] uppercase font-black text-slate-400 tracking-[0.3em] font-mono italic">Operating Expenses</span></div>
                    <PLRow label="支払手数料 (AI等)" amount={`¥${transactions.filter(t => t.category === '支払手数料').reduce((a, b) => a + b.amount, 0).toLocaleString()}`} />
                    <PLRow label="研究開発費 (マイくら等)" amount={`¥${transactions.filter(t => t.category === '研究開発費').reduce((a, b) => a + b.amount, 0).toLocaleString()}`} />
                    <PLRow label="通信費 (SaaS等)" amount={`¥${transactions.filter(t => t.category === '通信費').reduce((a, b) => a + b.amount, 0).toLocaleString()}`} />
                    <div className="pt-10">
                      <div className="flex justify-between items-center bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl shadow-teal-500/5 relative overflow-hidden group">
                        <div className="relative z-10">
                           <p className="text-[10px] font-black text-teal-400 uppercase tracking-[0.2em] mb-2 font-mono">Current Period Net Profit</p>
                           <span className="font-extrabold text-sm opacity-60">第{fiscalPeriod}期 当期純利益</span>
                        </div>
                        <span className="text-4xl font-black italic tracking-tighter text-teal-400 group-hover:scale-110 transition-transform origin-right z-10">¥{plData.profit.toLocaleString()}</span>
                        <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/10 blur-[60px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[50px] border border-slate-200 shadow-sm border-t-[12px] border-t-amber-400">
                <div className="flex items-center gap-3 mb-10">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-100 shadow-inner"><Archive size={24} /></div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">決算アーカイブ 📚</h3>
                </div>
                <div className="space-y-5">
                  {historicalData.map(h => (
                    <div key={h.id} className="group relative overflow-hidden bg-slate-50 border border-slate-100 p-6 rounded-[32px] transition-all hover:bg-white hover:border-amber-200 hover:shadow-2xl hover:-translate-y-1">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-amber-600 font-mono">{h.label}</span>
                        <div className="flex items-center gap-1.5 bg-green-50 text-green-600 px-3 py-1 rounded-full text-[9px] font-black border border-green-100 uppercase italic">
                          <CheckCircle2 size={10} /> {h.status}
                        </div>
                      </div>
                      <div className="flex justify-between items-end">
                        <p className="text-[10px] font-bold text-slate-400 font-mono">{h.date}</p>
                        <p className="text-xl font-black text-slate-800 italic tracking-tighter group-hover:scale-110 transition-transform origin-right">¥{h.profit.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                  
                  <div className="p-8 border-2 border-dashed border-slate-100 rounded-[32px] text-center space-y-4 group hover:border-teal-500/30 transition-all">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto group-hover:bg-teal-50 group-hover:scale-110 transition-all"><Clock className="text-slate-300 group-hover:text-teal-400" size={20}/></div>
                    <div>
                       <p className="text-[11px] font-black text-slate-400 uppercase italic tracking-widest group-hover:text-teal-600">第{displayPeriod}期 アーカイブ準備中</p>
                       <p className="text-[9px] text-slate-400 font-bold mt-1 px-4 italic leading-relaxed">全ての領収書がAIによって読み取られた段階で実行可能です。</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Balance Sheet */}
            <div className="bg-white p-10 rounded-[50px] border border-slate-200 shadow-sm border-t-[12px] border-t-indigo-500">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-inner"><BookOpen size={24}/></div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">第{fiscalPeriod}期 貸借対照表 (B/S)</h3>
                </div>
                <div className="flex items-center gap-3">
                  {bsTotals.totalAssets !== bsTotals.totalLiabilitiesAndEquity && (
                    <div className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-2xl text-xs font-black border border-rose-100">
                      <AlertCircle size={14}/> 貸借不一致
                    </div>
                  )}
                  {bsTotals.totalAssets === bsTotals.totalLiabilitiesAndEquity && (
                    <div className="flex items-center gap-2 bg-teal-50 text-teal-600 px-4 py-2 rounded-2xl text-xs font-black border border-teal-100">
                      <Check size={14}/> 貸借一致
                    </div>
                  )}
                  <button onClick={() => setBsEditMode(p => !p)} className={`px-5 py-2 rounded-2xl font-black text-xs transition-all ${bsEditMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>
                    {bsEditMode ? '完了' : '編集'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* 資産の部 */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 font-mono">資産の部</p>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-2">流動資産</p>
                    <BSRow label="現金・預金" value={bsData.cash} editMode={bsEditMode} onChange={v => setBsData(p => ({ ...p, cash: v }))} />
                    <BSRow label="売掛金" value={bsData.receivables} editMode={bsEditMode} onChange={v => setBsData(p => ({ ...p, receivables: v }))} />
                    <BSRow label="その他流動資産" value={bsData.otherCurrentAssets} editMode={bsEditMode} onChange={v => setBsData(p => ({ ...p, otherCurrentAssets: v }))} />
                    <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-2xl">
                      <span className="font-black text-sm text-slate-700">流動資産合計</span>
                      <span className="font-black font-mono text-slate-800">¥{bsTotals.totalCurrentAssets.toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-2 pt-4">固定資産</p>
                    <BSRow label="工具器具備品等" value={bsData.equipment} editMode={bsEditMode} onChange={v => setBsData(p => ({ ...p, equipment: v }))} />
                    <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-2xl">
                      <span className="font-black text-sm text-slate-700">固定資産合計</span>
                      <span className="font-black font-mono text-slate-800">¥{bsTotals.totalFixedAssets.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-6 bg-indigo-900 text-white px-8 py-5 rounded-[32px] shadow-2xl">
                    <span className="font-black text-sm">資産合計</span>
                    <span className="text-2xl font-black font-mono italic text-indigo-300">¥{bsTotals.totalAssets.toLocaleString()}</span>
                  </div>
                </div>

                {/* 負債・純資産の部 */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 font-mono">負債・純資産の部</p>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-2">流動負債</p>
                    <BSRow label="未払金" value={bsData.payables} editMode={bsEditMode} onChange={v => setBsData(p => ({ ...p, payables: v }))} />
                    <BSRow label="未払税金" value={bsData.taxPayable} editMode={bsEditMode} onChange={v => setBsData(p => ({ ...p, taxPayable: v }))} />
                    <BSRow label="その他負債" value={bsData.otherLiabilities} editMode={bsEditMode} onChange={v => setBsData(p => ({ ...p, otherLiabilities: v }))} />
                    <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-2xl">
                      <span className="font-black text-sm text-slate-700">負債合計</span>
                      <span className="font-black font-mono text-slate-800">¥{bsTotals.totalLiabilities.toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 py-2 pt-4">純資産</p>
                    <BSRow label="資本金" value={bsData.capital} editMode={bsEditMode} onChange={v => setBsData(p => ({ ...p, capital: v }))} />
                    <BSRow label="繰越利益剰余金（前期）" value={bsData.retainedEarnings} editMode={bsEditMode} onChange={v => setBsData(p => ({ ...p, retainedEarnings: v }))} />
                    <div className="flex justify-between items-center py-3 px-4 bg-teal-50 rounded-2xl border border-teal-100">
                      <span className="font-black text-sm text-teal-700">当期純利益（P/L連動）</span>
                      <span className="font-black font-mono text-teal-700">¥{plData.profit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-2xl">
                      <span className="font-black text-sm text-slate-700">純資産合計</span>
                      <span className="font-black font-mono text-slate-800">¥{bsTotals.totalEquity.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-6 bg-indigo-900 text-white px-8 py-5 rounded-[32px] shadow-2xl">
                    <span className="font-black text-sm">負債・純資産合計</span>
                    <span className="text-2xl font-black font-mono italic text-indigo-300">¥{bsTotals.totalLiabilitiesAndEquity.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-12 rounded-[60px] flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden group shadow-2xl">
               <div className="flex items-center gap-10 relative z-10">
                 <div className="w-24 h-24 bg-teal-400/10 rounded-[32px] flex items-center justify-center border-2 border-teal-500/20 group-hover:scale-110 transition-transform shadow-inner">
                    <Zap className="text-teal-400" size={48} fill="currentColor" />
                 </div>
                 <div className="max-w-md">
                   <h4 className="text-3xl font-black tracking-tight mb-4">確定申告、今年もAIにお任せ！✨</h4>
                   <p className="text-slate-400 leading-relaxed font-medium italic text-sm">3月31日までの納税、Supportiaがあなたの後ろ盾になります。完璧に整理・保管して、納税準備をスマートに。</p>
                 </div>
               </div>
               <button className="bg-white text-slate-900 px-12 py-6 rounded-[32px] font-black hover:bg-slate-50 transition-all active:scale-[0.98] shadow-2xl relative z-10 text-xl tracking-tighter group flex items-center gap-3">
                 申告用データを出力する <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
               </button>
               <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-teal-400/5 blur-[120px] rounded-full translate-x-1/3 translate-y-1/3"></div>
            </div>
          </div>
        ) : activeTab === 'transactions' ? (
          <div className="mt-8 space-y-8 animate-in slide-in-from-bottom-6 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3"><PencilLine className="text-indigo-500"/> 取引一覧 &amp; 手動入力</h2>
                <p className="text-slate-500 mt-1 font-bold italic text-sm">AIが自動処理できない取引は、ここから直接入力できます。即座にP/Lへ反映されます！✏️</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Records</p>
                <p className="text-3xl font-black text-slate-900 tracking-tighter italic">{transactions.length} 件</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Manual Entry Form */}
              <div className="lg:col-span-2">
                <form onSubmit={addManualTransaction} className="bg-white p-8 rounded-[50px] border border-slate-200 shadow-sm border-t-[10px] border-t-indigo-500 sticky top-8">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 border border-indigo-100 shadow-inner"><PencilLine size={22}/></div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800 tracking-tight">手動で取引を入力</h3>
                      <p className="text-[10px] text-slate-400 font-black italic uppercase tracking-widest">Manual Entry</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {/* Type Toggle */}
                    <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                      <button type="button" onClick={() => setManualForm(p => ({ ...p, type: 'expense' }))} className={`py-3 rounded-xl font-black text-sm transition-all ${manualForm.type === 'expense' ? 'bg-white shadow-lg text-rose-600 border border-rose-100' : 'text-slate-400 hover:text-slate-600'}`}>
                        💸 支出
                      </button>
                      <button type="button" onClick={() => setManualForm(p => ({ ...p, type: 'income' }))} className={`py-3 rounded-xl font-black text-sm transition-all ${manualForm.type === 'income' ? 'bg-white shadow-lg text-teal-600 border border-teal-100' : 'text-slate-400 hover:text-slate-600'}`}>
                        💰 収入
                      </button>
                    </div>

                    {/* Date */}
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">日付</label>
                      <input type="date" value={manualForm.date} onChange={e => setManualForm(p => ({ ...p, date: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-800 font-bold text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all" required/>
                    </div>

                    {/* Vendor */}
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">取引先・内容</label>
                      <input type="text" value={manualForm.vendor} onChange={e => setManualForm(p => ({ ...p, vendor: e.target.value }))} placeholder="例: AWS, クライアントA..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-800 font-bold text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all" required/>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">金額（円）</label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-400">¥</span>
                        <input type="number" value={manualForm.amount} onChange={e => setManualForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-5 py-3.5 text-slate-800 font-black text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all" required/>
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">勘定科目</label>
                      <select value={manualForm.category} onChange={e => setManualForm(p => ({ ...p, category: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-800 font-bold text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    {/* Source */}
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">ソース</label>
                      <select value={manualForm.source} onChange={e => setManualForm(p => ({ ...p, source: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-800 font-bold text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all">
                        <option>手動入力</option>
                        <option>Minecraft</option>
                        <option>T-Lab</option>
                        <option>Bank</option>
                        <option>System</option>
                      </select>
                    </div>

                    <button type="submit" className={`w-full py-5 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl text-base ${formSubmitted ? 'bg-teal-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200'}`}>
                      {formSubmitted ? <><CheckCircle2 size={20}/> 帳簿に追加しました！</> : <><Plus size={20}/> 台帳に登録する</>}
                    </button>
                  </div>
                </form>
              </div>

              {/* Transaction List */}
              <div className="lg:col-span-3 space-y-4">
                <div className="flex items-center justify-between px-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">全仕訳履歴（新しい順）</p>
                  <div className="flex items-center gap-4 text-[10px] font-black">
                    <span className="text-teal-600">収入: ¥{plData.income.toLocaleString()}</span>
                    <span className="text-rose-600">支出: ¥{plData.expense.toLocaleString()}</span>
                  </div>
                </div>
                {[...transactions].reverse().map(t => (
                  <div key={t.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between gap-4 group hover:border-indigo-200 hover:shadow-lg transition-all hover:-translate-y-0.5">
                    <div className="flex items-center gap-5 flex-1 min-w-0">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-teal-50 text-teal-600 border border-teal-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                        {t.type === 'income' ? <ArrowUpRight size={22}/> : <ArrowDownRight size={22}/>}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-widest">{t.source}</span>
                          <p className="font-black text-slate-800 text-sm tracking-tight truncate">{t.vendor}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400 font-mono">{t.date}</span>
                          <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">{t.category}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <p className={`text-lg font-black italic font-mono tracking-tighter ${t.type === 'income' ? 'text-teal-600' : 'text-rose-500'}`}>
                        {t.type === 'income' ? '+' : '-'}¥{t.amount.toLocaleString()}
                      </p>
                      <button onClick={() => deleteTransaction(t.id)} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 active:scale-90">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

      </main>
    </div>
  );
}

function BSRow({ label, value, editMode, onChange }: { label: string, value: number, editMode: boolean, onChange: (v: number) => void }) {
  return (
    <div className="flex justify-between items-center py-3 px-4 rounded-2xl hover:bg-slate-50 transition-all group">
      <span className="text-sm text-slate-500 font-bold">{label}</span>
      {editMode ? (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">¥</span>
          <input
            type="number"
            value={value}
            onChange={e => onChange(parseInt(e.target.value) || 0)}
            className="w-36 bg-white border border-indigo-200 rounded-xl pl-7 pr-3 py-1.5 text-slate-800 font-black text-sm text-right outline-none focus:border-indigo-400 transition-all"
          />
        </div>
      ) : (
        <span className="font-bold font-mono text-slate-800 group-hover:scale-105 transition-transform">¥{value.toLocaleString()}</span>
      )}
    </div>
  );
}

function PLRow({ label, amount, bold, highlight }: { label: string, amount: string, bold?: boolean, highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-4 px-6 rounded-[24px] transition-all hover:bg-slate-50 group ${highlight ? 'bg-teal-50 text-teal-900 border border-teal-100' : ''}`}>
      <span className={`${bold || highlight ? 'font-black' : 'text-slate-500 font-bold'} text-sm tracking-tight`}>{label}</span>
      <span className={`${bold || highlight ? 'font-black text-lg' : 'font-bold text-slate-800'} font-mono tracking-tighter group-hover:scale-105 transition-transform`}>{amount}</span>
    </div>
  );
}

function Header({ onSync, isSyncing, onScan, isScanning }: { onSync: () => void, isSyncing: boolean, onScan: () => void, isScanning: boolean }) {
  return (
    <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Supportia Dashboard</h1>
        <p className="text-slate-500 mt-2 font-black text-[10px] uppercase tracking-[0.4em] font-mono italic flex items-center gap-2">
           <Sparkles size={14} className="text-teal-500"/> AI Tax Solution Activated
        </p>
      </div>
      <div className="flex items-center gap-4 w-full md:w-auto">
        <button onClick={onScan} disabled={isScanning} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white border border-slate-800 px-8 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl active:scale-95 disabled:opacity-50">
          {isScanning ? <RefreshCw size={20} className="animate-spin text-teal-400" /> : <Zap size={20} className="text-teal-400" fill="currentColor" />}
          <span>{isScanning ? 'AI巡回中...' : 'ドライブを一括スキャン'}</span>
        </button>
        <button onClick={onSync} className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-90">
          <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
        </button>
        <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center border-2 border-white shadow-2xl relative group cursor-pointer hover:rotate-6 transition-transform">
          <span className="text-indigo-700 font-extrabold text-xl">TT</span>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 border-2 border-white rounded-full"></div>
        </div>
      </div>
    </header>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`flex items-center gap-4 px-5 py-4 rounded-[20px] cursor-pointer transition-all ${active ? 'bg-teal-600 text-white shadow-2xl shadow-teal-500/40 translate-x-2' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900 group'}`}>
      <span className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-teal-600'} transition-all`}>{icon}</span>
      <span className="font-black text-[11px] uppercase tracking-[0.1em]">{label}</span>
      {active && <div className="ml-auto w-2 h-2 bg-white rounded-full shadow-lg"></div>}
    </div>
  );
}

function StatCard({ title, amount, trend, isPositive, icon }: { title: string, amount: string, trend: string, isPositive: boolean, icon: any }) {
  return (
    <div className="bg-white p-10 rounded-[50px] border border-slate-200 shadow-sm hover:shadow-2xl hover:-translate-y-3 transition-all group overflow-hidden relative bg-gradient-to-br from-white to-slate-50/30">
      <div className="flex items-center justify-between mb-8">
        <p className="text-[11px] font-black text-slate-400 group-hover:text-teal-600 transition-colors uppercase tracking-[0.2em]">{title}</p>
        <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-teal-50 group-hover:text-teal-600 transition-all border border-slate-100 shadow-inner">{icon}</div>
      </div>
      <div className="flex items-end justify-between relative z-10">
        <h3 className="text-3xl font-black text-slate-900 font-mono tracking-tighter group-hover:scale-110 transition-transform origin-left italic">{amount}</h3>
        <div className={`flex items-center gap-1 text-[11px] font-black px-3 py-1.5 rounded-full ${isPositive ? 'bg-teal-50 text-teal-600 border border-teal-100' : 'bg-rose-50 text-rose-600 border border-rose-100 shadow-sm'}`}>{trend}</div>
      </div>
      <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-teal-500/5 blur-[50px] rounded-full group-hover:scale-150 transition-all duration-700"></div>
    </div>
  );
}

function FolderSource({ name, url, status, color }: { name: string, url: string, status: string, color: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="bg-white p-6 rounded-[32px] border border-slate-200 flex items-center justify-between group hover:border-teal-500/40 hover:shadow-2xl transition-all">
      <div className="flex items-center gap-5">
        <div className={`w-14 h-14 ${color} bg-opacity-10 rounded-2xl flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform shrink-0 border border-transparent group-hover:border-white shadow-inner`}><FolderOpen size={28} className={color.replace('bg-', 'text-')} /></div>
        <div className="overflow-hidden">
          <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest truncate">{name}</h4>
          <p className="text-[10px] text-slate-400 mt-1 font-bold italic tracking-tight font-mono opacity-60">Connected: G-Drive</p>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full border border-slate-100 group-hover:bg-teal-50 transition-colors shrink-0">
        <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(20,184,166,0.8)]"></div>
        <span className="text-[10px] font-black text-teal-600 uppercase tracking-tighter">{status}</span>
      </div>
    </a>
  );
}

function ProcessingItem({ name, category, amount, source }: { name: string, category: string, amount: string, source: string }) {
  return (
    <div className="group border-b border-slate-50 pb-6 last:border-0 last:pb-0 transition-all hover:bg-slate-50/50 p-2 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="px-2.5 py-1 bg-slate-900 rounded-lg text-[9px] font-black text-white uppercase tracking-widest shadow-lg">{source}</div>
          <div className="flex flex-col">
             <p className="text-sm font-black text-slate-800 tracking-tight group-hover:text-teal-700 transition-colors truncate max-w-[180px]">{name}</p>
             <span className="text-[10px] font-bold text-slate-400 italic mt-0.5">{category}</span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
           <span className="text-sm font-black text-slate-900 font-mono italic tracking-tighter">{amount}</span>
           <span className="text-[10px] font-black text-teal-600 uppercase flex items-center gap-1 tracking-widest"><Check size={12}/> 確認済</span>
        </div>
      </div>
      <div className="flex items-center gap-4 px-1">
        <div className="flex-1 h-2 bg-teal-50 rounded-full overflow-hidden shadow-inner border border-teal-100/50"><div className="h-full bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.4)]" style={{ width: '100%' }}></div></div>
      </div>
    </div>
  );
}

function AiSuccessToast() {
  return (
    <div className="fixed bottom-10 right-10 bg-slate-900 border border-teal-500/50 text-white px-8 py-6 rounded-[40px] shadow-2xl z-[100] animate-in slide-in-from-right-10 duration-500 flex items-center gap-6 outline outline-8 outline-teal-500/10 hover:scale-105 transition-transform">
       <div className="w-14 h-14 bg-teal-500 rounded-3xl flex items-center justify-center text-slate-900 shadow-xl shadow-teal-500/20">
          <Sparkles size={28} fill="currentColor" />
       </div>
       <div>
         <h5 className="font-black text-xl tracking-tight">AI仕分け完了！🚀✨</h5>
         <p className="text-slate-400 text-sm font-medium italic">取引がメイン台帳に正しく反映されました。</p>
       </div>
    </div>
  );
}

function ArchiveSuccessToast() {
  return (
    <div className="fixed bottom-10 right-10 bg-slate-900 border border-amber-500/50 text-white px-8 py-6 rounded-[40px] shadow-2xl z-[100] animate-in slide-in-from-bottom-10 duration-500 flex items-center gap-6 outline outline-8 outline-amber-500/10">
       <div className="w-14 h-14 bg-amber-500 rounded-3xl flex items-center justify-center text-slate-900 shadow-xl shadow-amber-500/20">
          <Archive size={28} />
       </div>
       <div>
         <h5 className="font-black text-xl tracking-tight">アーカイブ成功！🕰️✨</h5>
         <p className="text-slate-400 text-sm font-medium italic">第{new Date().getMonth() < 3 ? 2 : 3}期のデータが永久保存されました。</p>
       </div>
    </div>
  );
}

export default App;
