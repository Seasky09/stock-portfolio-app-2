import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pencil, Plus, RefreshCw, LogOut, LogIn } from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const STOCK_OPTIONS = [
  { name: "삼성전자", ticker: "005930.KS" },
  { name: "SK하이닉스", ticker: "000660.KS" },
  { name: "한화솔루션", ticker: "009830.KS" },
  { name: "현대차", ticker: "005380.KS" },
  { name: "애플", ticker: "AAPL" },
  { name: "엔비디아", ticker: "NVDA" },
  { name: "테슬라", ticker: "TSLA" },
  { name: "QQQ", ticker: "QQQ" },
  { name: "SPY", ticker: "SPY" },
];

const EMPTY_FORM = {
  id: null,
  date: new Date().toISOString().slice(0, 10),
  stock_name: "",
  ticker: "",
  type: "buy",
  qty: "",
  price: "",
  fee: "0",
  tax: "0",
  memo: "",
};

function won(value) {
  const n = Number(value || 0);
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function signedWon(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${Math.round(n).toLocaleString("ko-KR")}원`;
}

function signedPct(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function gainColor(value) {
  return Number(value || 0) >= 0 ? "text-emerald-600" : "text-red-600";
}

function computePortfolio(trades, prices) {
  const sorted = [...trades].sort(
    (a, b) => a.date.localeCompare(b.date) || a.created_at?.localeCompare?.(b.created_at || "") || 0
  );
  const buckets = {};
  const realizedRows = [];
  let totalRealized = 0;

  for (const raw of sorted) {
    const t = {
      ...raw,
      qty: Number(raw.qty || 0),
      price: Number(raw.price || 0),
      fee: Number(raw.fee || 0),
      tax: Number(raw.tax || 0),
    };

    if (!buckets[t.ticker]) {
      buckets[t.ticker] = {
        ticker: t.ticker,
        stock_name: t.stock_name,
        qty: 0,
        totalCost: 0,
      };
    }

    const bucket = buckets[t.ticker];

    if (t.type === "buy") {
      bucket.qty += t.qty;
      bucket.totalCost += t.qty * t.price + t.fee;
    } else {
      const avg = bucket.qty > 0 ? bucket.totalCost / bucket.qty : 0;
      const soldQty = Math.min(t.qty, bucket.qty);
      const costBasis = avg * soldQty;
      const proceeds = t.price * soldQty;
      const realized = proceeds - costBasis - t.fee - t.tax;
      totalRealized += realized;
      realizedRows.push({
        ...t,
        avgPriceAtSell: avg,
        realized,
        realizedPct: avg > 0 ? ((t.price - avg) / avg) * 100 : 0,
      });
      bucket.qty -= soldQty;
      bucket.totalCost -= costBasis;
    }
  }

  const holdings = Object.values(buckets)
    .filter((item) => item.qty > 0)
    .map((item) => {
      const avgPrice = item.qty > 0 ? item.totalCost / item.qty : 0;
      const currentPrice = Number(prices[item.ticker] || 0);
      const valuation = currentPrice * item.qty;
      const gain = valuation - item.totalCost;
      const gainPct = item.totalCost > 0 ? (gain / item.totalCost) * 100 : 0;
      return {
        ...item,
        avgPrice,
        currentPrice,
        valuation,
        gain,
        gainPct,
      };
    });

  const totalCost = holdings.reduce((sum, item) => sum + item.totalCost, 0);
  const totalValuation = holdings.reduce((sum, item) => sum + item.valuation, 0);
  const totalGain = totalValuation - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  return {
    holdings,
    realizedRows: realizedRows.reverse(),
    totalRealized,
    totalCost,
    totalValuation,
    totalGain,
    totalGainPct,
  };
}

function getSellableQty(trades, ticker, editingId = null) {
  const relevant = trades
    .filter((t) => t.ticker === ticker && t.id !== editingId)
    .sort((a, b) => a.date.localeCompare(b.date));

  let qty = 0;
  for (const t of relevant) {
    qty += t.type === "buy" ? Number(t.qty || 0) : -Number(t.qty || 0);
  }
  return Math.max(0, qty);
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState([]);
  const [manualPrices, setManualPrices] = useState({});
  const [livePrices, setLivePrices] = useState({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [email, setEmail] = useState("");
  const [authMode, setAuthMode] = useState("magic-link");

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError("Supabase 환경변수가 아직 설정되지 않았습니다. 배포 전에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 넣어야 합니다.");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchAll();
    } else {
      setTrades([]);
      setManualPrices({});
      setLivePrices({});
    }
  }, [session]);

  useEffect(() => {
    if (session && trades.length > 0) {
      fetchLivePrices();
    }
  }, [session, trades]);

  async function fetchAll() {
    if (!supabase || !session?.user) return;
    setLoading(true);
    setError("");

    const [{ data: tradeRows, error: tradeError }, { data: priceRows, error: priceError }] = await Promise.all([
      supabase
        .from("portfolio_trades")
        .select("*")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("portfolio_prices").select("ticker, price").eq("user_id", session.user.id),
    ]);

    if (tradeError) setError(`거래 불러오기 오류: ${tradeError.message}`);
    if (priceError) setError(`현재가 불러오기 오류: ${priceError.message}`);

    setTrades(tradeRows || []);

    const priceMap = {};
    for (const row of priceRows || []) {
      priceMap[row.ticker] = Number(row.price || 0);
    }
    setManualPrices(priceMap);
    setLoading(false);
  }

  async function fetchLivePrices() {
    const tickers = [...new Set(trades.map((t) => t.ticker).filter(Boolean))];
    if (tickers.length === 0) return;

    try {
      setPriceLoading(true);
      const response = await fetch(`/api/prices?tickers=${encodeURIComponent(tickers.join(","))}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "현재가 조회 실패");
      }

      setLivePrices(data.prices || {});
    } catch (err) {
      setError(`현재가 자동조회 오류: ${err.message}`);
    } finally {
      setPriceLoading(false);
    }
  }

  const mergedPrices = useMemo(() => ({ ...livePrices, ...manualPrices }), [livePrices, manualPrices]);

  const summary = useMemo(() => computePortfolio(trades, mergedPrices), [trades, mergedPrices]);

  const recentTrades = useMemo(() => [...trades].slice(0, 5), [trades]);

  function openCreateDialog() {
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setError("");
    setDialogOpen(true);
  }

  function openEditDialog(row) {
    setForm({
      id: row.id,
      date: row.date,
      stock_name: row.stock_name,
      ticker: row.ticker,
      type: row.type,
      qty: String(row.qty),
      price: String(row.price),
      fee: String(row.fee ?? 0),
      tax: String(row.tax ?? 0),
      memo: row.memo ?? "",
    });
    setError("");
    setDialogOpen(true);
  }

  function applyStockOption(value) {
    const selected = STOCK_OPTIONS.find((item) => item.ticker === value);
    if (!selected) return;
    setForm((prev) => ({ ...prev, ticker: selected.ticker, stock_name: selected.name }));
  }

  function validateForm() {
    const qty = Number(form.qty);
    const price = Number(form.price);
    const fee = Number(form.fee || 0);
    const tax = Number(form.tax || 0);

    if (!form.date) return "거래일을 입력해야 합니다.";
    if (!form.stock_name.trim()) return "종목명을 입력해야 합니다.";
    if (!form.ticker.trim()) return "종목코드를 입력해야 합니다.";
    if (!(qty > 0)) return "수량은 0보다 커야 합니다.";
    if (!(price > 0)) return "단가는 0보다 커야 합니다.";
    if (fee < 0 || tax < 0) return "수수료와 세금은 0 이상이어야 합니다.";

    if (form.type === "sell") {
      const sellableQty = getSellableQty(trades, form.ticker, form.id);
      if (qty > sellableQty) {
        return `매도 가능 수량(${sellableQty}주)을 초과했습니다.`;
      }
    }

    return "";
  }

  async function saveTrade() {
    if (!supabase || !session?.user) return;
    const validationMessage = validateForm();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setError("");
    const payload = {
      user_id: session.user.id,
      date: form.date,
      stock_name: form.stock_name.trim(),
      ticker: form.ticker.trim(),
      type: form.type,
      qty: Number(form.qty),
      price: Number(form.price),
      fee: Number(form.fee || 0),
      tax: Number(form.tax || 0),
      memo: form.memo.trim(),
    };

    let result;
    if (form.id) {
      result = await supabase.from("portfolio_trades").update(payload).eq("id", form.id).eq("user_id", session.user.id);
    } else {
      result = await supabase.from("portfolio_trades").insert(payload);
    }

    if (result.error) {
      setError(`저장 오류: ${result.error.message}`);
      return;
    }

    setDialogOpen(false);
    setInfo(form.id ? "거래를 수정했습니다." : "거래를 추가했습니다.");
    await fetchAll();
  }

  async function deleteTrade(id) {
    if (!supabase || !session?.user) return;
    const ok = window.confirm("이 거래를 삭제하시겠습니까?");
    if (!ok) return;

    const { error: deleteError } = await supabase.from("portfolio_trades").delete().eq("id", id).eq("user_id", session.user.id);

    if (deleteError) {
      setError(`삭제 오류: ${deleteError.message}`);
      return;
    }

    setInfo("거래를 삭제했습니다.");
    await fetchAll();
  }

  async function saveManualPrice(ticker, value) {
    if (!supabase || !session?.user) return;
    const price = Number(value || 0);
    if (price < 0) return;

    setManualPrices((prev) => ({ ...prev, [ticker]: price }));

    const payload = {
      user_id: session.user.id,
      ticker,
      price,
    };

    const { error: upsertError } = await supabase.from("portfolio_prices").upsert(payload, { onConflict: "user_id,ticker" });

    if (upsertError) {
      setError(`현재가 저장 오류: ${upsertError.message}`);
    }
  }

  async function signIn() {
    if (!supabase) return;
    setError("");
    setInfo("");

    if (!email.trim()) {
      setError("이메일을 입력해 주세요.");
      return;
    }

    if (authMode === "magic-link") {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.href : undefined,
        },
      });

      if (signInError) {
        setError(`로그인 오류: ${signInError.message}`);
      } else {
        setInfo("이메일로 로그인 링크를 보냈습니다.");
      }
    } else {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: "google" });
      if (oauthError) setError(`구글 로그인 오류: ${oauthError.message}`);
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setInfo("로그아웃되었습니다.");
  }

  const schemaSql = `
create table if not exists public.portfolio_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  date date not null,
  stock_name text not null,
  ticker text not null,
  type text not null check (type in ('buy','sell')),
  qty numeric not null check (qty > 0),
  price numeric not null check (price > 0),
  fee numeric not null default 0 check (fee >= 0),
  tax numeric not null default 0 check (tax >= 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ticker text not null,
  price numeric not null default 0 check (price >= 0),
  updated_at timestamptz not null default now(),
  unique(user_id, ticker)
);

alter table public.portfolio_trades enable row level security;
alter table public.portfolio_prices enable row level security;

create policy if not exists trades_select on public.portfolio_trades for select using (auth.uid() = user_id);
create policy if not exists trades_insert on public.portfolio_trades for insert with check (auth.uid() = user_id);
create policy if not exists trades_update on public.portfolio_trades for update using (auth.uid() = user_id);
create policy if not exists trades_delete on public.portfolio_trades for delete using (auth.uid() = user_id);

create policy if not exists prices_select on public.portfolio_prices for select using (auth.uid() = user_id);
create policy if not exists prices_insert on public.portfolio_prices for insert with check (auth.uid() = user_id);
create policy if not exists prices_update on public.portfolio_prices for update using (auth.uid() = user_id);
create policy if not exists prices_delete on public.portfolio_prices for delete using (auth.uid() = user_id);
  `.trim();

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-8 text-sm text-slate-600">불러오는 중입니다...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">주식관리 웹앱 최소형</h1>
            <p className="text-sm text-slate-500">꼭 필요한 기능만 넣었습니다. 로그인 · 거래기록 · 보유종목 · 실현손익 · 현재가 자동조회</p>
          </div>
          {session && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  await fetchAll();
                  await fetchLivePrices();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {priceLoading ? "현재가 조회중..." : "새로고침"}
              </Button>
              <Button variant="outline" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />로그아웃
              </Button>
            </div>
          )}
        </div>

        {error && (
          <Alert className="border-red-200 bg-red-50 text-red-700">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {info && (
          <Alert className="border-blue-200 bg-blue-50 text-blue-700">
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        )}

        {!session ? (
          <Card className="mx-auto max-w-lg">
            <CardHeader>
              <CardTitle>로그인</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">이메일</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="flex gap-2">
                <Button variant={authMode === "magic-link" ? "default" : "outline"} onClick={() => setAuthMode("magic-link")}>이메일 링크</Button>
                <Button variant={authMode === "google" ? "default" : "outline"} onClick={() => setAuthMode("google")}>구글 로그인</Button>
              </div>
              <Button className="w-full" onClick={signIn}>
                <LogIn className="mr-2 h-4 w-4" />로그인 시작
              </Button>
              <div className="rounded-xl bg-slate-100 p-4 text-xs leading-6 text-slate-600">
                <div className="font-semibold text-slate-800">Supabase에 먼저 만들어야 하는 것</div>
                <div>① Authentication에서 Email 또는 Google 로그인 활성화</div>
                <div>② SQL Editor에 아래 테이블 생성 SQL 실행</div>
              </div>
              <pre className="max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{schemaSql}</pre>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard title="총 투자원금" value={won(summary.totalCost)} />
              <MetricCard title="현재 평가금액" value={won(summary.totalValuation)} />
              <MetricCard title="평가손익" value={signedWon(summary.totalGain)} className={gainColor(summary.totalGain)} />
              <MetricCard title="평가수익률" value={signedPct(summary.totalGainPct)} className={gainColor(summary.totalGainPct)} />
              <MetricCard title="실현손익" value={signedWon(summary.totalRealized)} className={gainColor(summary.totalRealized)} />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-4 md:w-[640px]">
                <TabsTrigger value="dashboard">대시보드</TabsTrigger>
                <TabsTrigger value="holdings">보유 종목</TabsTrigger>
                <TabsTrigger value="trades">거래 내역</TabsTrigger>
                <TabsTrigger value="realized">실현손익</TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>최근 거래</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {recentTrades.length === 0 && <div className="text-sm text-slate-500">아직 거래가 없습니다.</div>}
                      {recentTrades.map((row) => (
                        <div key={row.id} className="flex items-center justify-between rounded-xl border p-3">
                          <div>
                            <div className="font-medium text-slate-900">{row.stock_name}</div>
                            <div className="text-xs text-slate-500">{row.date} · {row.ticker}</div>
                          </div>
                          <div className="text-right">
                            <Badge variant={row.type === "buy" ? "default" : "destructive"}>{row.type === "buy" ? "매수" : "매도"}</Badge>
                            <div className="mt-2 text-sm text-slate-700">{Number(row.qty).toLocaleString("ko-KR")}주 · {won(row.price)}</div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>안내</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm leading-7 text-slate-600">
                      <div>① 이 버전은 꼭 필요한 기능만 넣은 최소형입니다.</div>
                      <div>② 현재가는 자동 조회되며 필요하면 직접 수정할 수 있습니다.</div>
                      <div>③ 여러 기기에서 같은 데이터를 쓰려면 Supabase에 배포해야 합니다.</div>
                      <div>④ 거래 추가와 수정은 거래 내역 탭에서 처리합니다.</div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="holdings">
                <Card>
                  <CardHeader>
                    <CardTitle>보유 종목</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary.holdings.length === 0 ? (
                      <div className="text-sm text-slate-500">보유 종목이 없습니다.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>종목명</TableHead>
                              <TableHead>코드</TableHead>
                              <TableHead className="text-right">보유수량</TableHead>
                              <TableHead className="text-right">평균단가</TableHead>
                              <TableHead className="text-right">현재가 입력</TableHead>
                              <TableHead className="text-right">평가금액</TableHead>
                              <TableHead className="text-right">평가손익</TableHead>
                              <TableHead className="text-right">수익률</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summary.holdings.map((row) => (
                              <TableRow key={row.ticker}>
                                <TableCell className="font-medium">{row.stock_name}</TableCell>
                                <TableCell>{row.ticker}</TableCell>
                                <TableCell className="text-right">{Number(row.qty).toLocaleString("ko-KR")}</TableCell>
                                <TableCell className="text-right">{won(Math.round(row.avgPrice))}</TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    className="ml-auto w-28 text-right"
                                    type="number"
                                    value={manualPrices[row.ticker] ?? livePrices[row.ticker] ?? 0}
                                    onChange={(e) => saveManualPrice(row.ticker, e.target.value)}
                                  />
                                </TableCell>
                                <TableCell className="text-right">{won(Math.round(row.valuation))}</TableCell>
                                <TableCell className={`text-right font-semibold ${gainColor(row.gain)}`}>{signedWon(Math.round(row.gain))}</TableCell>
                                <TableCell className={`text-right font-semibold ${gainColor(row.gainPct)}`}>{signedPct(row.gainPct)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trades">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>거래 내역</CardTitle>
                    <Button onClick={openCreateDialog}><Plus className="mr-2 h-4 w-4" />거래 추가</Button>
                  </CardHeader>
                  <CardContent>
                    {trades.length === 0 ? (
                      <div className="text-sm text-slate-500">아직 거래가 없습니다.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>날짜</TableHead>
                              <TableHead>종목명</TableHead>
                              <TableHead>코드</TableHead>
                              <TableHead>구분</TableHead>
                              <TableHead className="text-right">수량</TableHead>
                              <TableHead className="text-right">단가</TableHead>
                              <TableHead className="text-right">수수료</TableHead>
                              <TableHead className="text-right">세금</TableHead>
                              <TableHead>메모</TableHead>
                              <TableHead className="text-right">관리</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {trades.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell>{row.date}</TableCell>
                                <TableCell className="font-medium">{row.stock_name}</TableCell>
                                <TableCell>{row.ticker}</TableCell>
                                <TableCell>
                                  <Badge variant={row.type === "buy" ? "default" : "destructive"}>{row.type === "buy" ? "매수" : "매도"}</Badge>
                                </TableCell>
                                <TableCell className="text-right">{Number(row.qty).toLocaleString("ko-KR")}</TableCell>
                                <TableCell className="text-right">{won(row.price)}</TableCell>
                                <TableCell className="text-right">{won(row.fee)}</TableCell>
                                <TableCell className="text-right">{won(row.tax)}</TableCell>
                                <TableCell className="max-w-[180px] truncate text-slate-500">{row.memo || "-"}</TableCell>
                                <TableCell>
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="icon" onClick={() => openEditDialog(row)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={() => deleteTrade(row.id)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="realized">
                <Card>
                  <CardHeader>
                    <CardTitle>실현손익</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary.realizedRows.length === 0 ? (
                      <div className="text-sm text-slate-500">아직 매도 거래가 없습니다.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>매도일</TableHead>
                              <TableHead>종목명</TableHead>
                              <TableHead className="text-right">수량</TableHead>
                              <TableHead className="text-right">매도단가</TableHead>
                              <TableHead className="text-right">평균매입단가</TableHead>
                              <TableHead className="text-right">실현손익</TableHead>
                              <TableHead className="text-right">수익률</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summary.realizedRows.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell>{row.date}</TableCell>
                                <TableCell className="font-medium">{row.stock_name}</TableCell>
                                <TableCell className="text-right">{Number(row.qty).toLocaleString("ko-KR")}</TableCell>
                                <TableCell className="text-right">{won(row.price)}</TableCell>
                                <TableCell className="text-right">{won(Math.round(row.avgPriceAtSell))}</TableCell>
                                <TableCell className={`text-right font-semibold ${gainColor(row.realized)}`}>{signedWon(Math.round(row.realized))}</TableCell>
                                <TableCell className={`text-right font-semibold ${gainColor(row.realizedPct)}`}>{signedPct(row.realizedPct)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "거래 수정" : "거래 추가"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>거래일</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>구분</Label>
              <div className="flex gap-2">
                <Button type="button" variant={form.type === "buy" ? "default" : "outline"} onClick={() => setForm((prev) => ({ ...prev, type: "buy" }))}>매수</Button>
                <Button type="button" variant={form.type === "sell" ? "default" : "outline"} onClick={() => setForm((prev) => ({ ...prev, type: "sell" }))}>매도</Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>빠른 선택</Label>
              <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.ticker} onChange={(e) => applyStockOption(e.target.value)}>
                <option value="">직접 입력 또는 선택</option>
                {STOCK_OPTIONS.map((item) => (
                  <option key={item.ticker} value={item.ticker}>{item.name} ({item.ticker})</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>종목명</Label>
              <Input value={form.stock_name} onChange={(e) => setForm((prev) => ({ ...prev, stock_name: e.target.value }))} placeholder="예: 삼성전자" />
            </div>
            <div className="grid gap-2">
              <Label>종목코드</Label>
              <Input value={form.ticker} onChange={(e) => setForm((prev) => ({ ...prev, ticker: e.target.value }))} placeholder="예: 005930.KS / AAPL" />
            </div>
            <div className="grid gap-2">
              <Label>수량</Label>
              <Input type="number" value={form.qty} onChange={(e) => setForm((prev) => ({ ...prev, qty: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>단가</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>수수료</Label>
              <Input type="number" value={form.fee} onChange={(e) => setForm((prev) => ({ ...prev, fee: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>세금</Label>
              <Input type="number" value={form.tax} onChange={(e) => setForm((prev) => ({ ...prev, tax: e.target.value }))} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>메모</Label>
              <Input value={form.memo} onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))} placeholder="선택사항" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={saveTrade}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ title, value, className = "text-slate-900" }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-[clamp(18px,2vw,32px)] leading-tight break-all font-bold ${className}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
