import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const STOCK_OPTIONS = [
  { name: "삼성전자", ticker: "005930.KS" },
  { name: "SK하이닉스", ticker: "000660.KS" },
  { name: "한화솔루션", ticker: "009830.KS" },
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
  return `${n.toLocaleString("ko-KR")}원`;
}

function signedWon(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("ko-KR")}원`;
}

function signedPct(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function computePortfolio(trades, manualPrices) {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date) || (a.created_at || "").localeCompare(b.created_at || ""));
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
      const currentPrice = Number(manualPrices[item.ticker] || 0);
      const valuation = currentPrice * item.qty;
      const gain = valuation - item.totalCost;
      const gainPct = item.totalCost > 0 ? (gain / item.totalCost) * 100 : 0;
      return { ...item, avgPrice, currentPrice, valuation, gain, gainPct };
    });

  const totalCost = holdings.reduce((sum, item) => sum + item.totalCost, 0);
  const totalValuation = holdings.reduce((sum, item) => sum + item.valuation, 0);
  const totalGain = totalValuation - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  return { holdings, realizedRows: realizedRows.reverse(), totalRealized, totalCost, totalValuation, totalGain, totalGainPct };
}

function getSellableQty(trades, ticker, editingId = null) {
  const relevant = trades
    .filter((t) => t.ticker === ticker && t.id !== editingId)
    .sort((a, b) => a.date.localeCompare(b.date));

  let qty = 0;
  for (const t of relevant) qty += t.type === "buy" ? Number(t.qty || 0) : -Number(t.qty || 0);
  return Math.max(0, qty);
}

function gainClass(value) {
  return Number(value || 0) >= 0 ? "positive" : "negative";
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState([]);
  const [manualPrices, setManualPrices] = useState({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError("환경변수가 없습니다. Vercel에 VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY를 넣어야 합니다.");
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
    if (session) fetchAll();
    else {
      setTrades([]);
      setManualPrices({});
    }
  }, [session]);

  async function fetchAll() {
    if (!supabase || !session?.user) return;
    setLoading(true);
    setError("");

    const [{ data: tradeRows, error: tradeError }, { data: priceRows, error: priceError }] = await Promise.all([
      supabase.from("portfolio_trades").select("*").eq("user_id", session.user.id).order("date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("portfolio_prices").select("ticker, price").eq("user_id", session.user.id),
    ]);

    if (tradeError) setError(`거래 불러오기 오류: ${tradeError.message}`);
    if (priceError) setError(`현재가 불러오기 오류: ${priceError.message}`);

    setTrades(tradeRows || []);
    const priceMap = {};
    for (const row of priceRows || []) priceMap[row.ticker] = Number(row.price || 0);
    setManualPrices(priceMap);
    setLoading(false);
  }

  const summary = useMemo(() => computePortfolio(trades, manualPrices), [trades, manualPrices]);
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
      if (qty > sellableQty) return `매도 가능 수량(${sellableQty}주)을 초과했습니다.`;
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
    if (form.id) result = await supabase.from("portfolio_trades").update(payload).eq("id", form.id).eq("user_id", session.user.id);
    else result = await supabase.from("portfolio_trades").insert(payload);

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
    if (!window.confirm("이 거래를 삭제하시겠습니까?")) return;

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

    const { error: upsertError } = await supabase.from("portfolio_prices").upsert(
      { user_id: session.user.id, ticker, price },
      { onConflict: "user_id,ticker" }
    );

    if (upsertError) setError(`현재가 저장 오류: ${upsertError.message}`);
  }

  async function signIn() {
    if (!supabase) return;
    setError("");
    setInfo("");

    if (!email.trim()) {
      setError("이메일을 입력해 주세요.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (signInError) setError(`로그인 오류: ${signInError.message}`);
    else setInfo("이메일로 로그인 링크를 보냈습니다.");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setInfo("로그아웃되었습니다.");
  }

  if (loading) return <div className="page"><div className="card">불러오는 중입니다...</div></div>;

  return (
    <div className="page">
      <div className="container">
        <div className="topbar">
          <div>
            <h1>주식관리 웹앱 최소형</h1>
            <p>꼭 필요한 기능만 넣었습니다. 로그인 · 거래기록 · 보유종목 · 실현손익 · 현재가 수동입력</p>
          </div>
          {session && (
            <div className="row gap8">
              <button className="btn secondary" onClick={fetchAll}>새로고침</button>
              <button className="btn secondary" onClick={signOut}>로그아웃</button>
            </div>
          )}
        </div>

        {error && <div className="alert error">{error}</div>}
        {info && <div className="alert info">{info}</div>}

        {!session ? (
          <div className="card narrow">
            <h2>로그인</h2>
            <label>이메일</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <button className="btn primary full" onClick={signIn}>로그인 링크 보내기</button>
            <div className="note">
              수파베이스에서 Email 로그인을 켜고, Vercel 환경변수에 두 값을 넣으면 바로 사용 가능합니다.
            </div>
          </div>
        ) : (
          <>
            <div className="metrics">
              <Metric title="총 투자원금" value={won(summary.totalCost)} />
              <Metric title="현재 평가금액" value={won(summary.totalValuation)} />
              <Metric title="평가손익" value={signedWon(summary.totalGain)} cls={gainClass(summary.totalGain)} />
              <Metric title="평가수익률" value={signedPct(summary.totalGainPct)} cls={gainClass(summary.totalGainPct)} />
              <Metric title="실현손익" value={signedWon(summary.totalRealized)} cls={gainClass(summary.totalRealized)} />
            </div>

            <div className="tabs">
              {["dashboard", "holdings", "trades", "realized"].map((tab) => (
                <button key={tab} className={`tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                  {tab === "dashboard" ? "대시보드" : tab === "holdings" ? "보유 종목" : tab === "trades" ? "거래 내역" : "실현손익"}
                </button>
              ))}
            </div>

            {activeTab === "dashboard" && (
              <div className="grid2">
                <div className="card">
                  <h2>최근 거래</h2>
                  {recentTrades.length === 0 ? <div className="muted">아직 거래가 없습니다.</div> : recentTrades.map((row) => (
                    <div key={row.id} className="tradeBox">
                      <div>
                        <div className="bold">{row.stock_name}</div>
                        <div className="small">{row.date} · {row.ticker}</div>
                      </div>
                      <div className="right">
                        <span className={`pill ${row.type}`}>{row.type === "buy" ? "매수" : "매도"}</span>
                        <div className="small" style={{marginTop: 8}}>{Number(row.qty).toLocaleString("ko-KR")}주 · {won(row.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <h2>안내</h2>
                  <div className="line">① 이 버전은 꼭 필요한 기능만 넣은 최소형입니다.</div>
                  <div className="line">② 현재가는 자동연동 없이 직접 입력합니다.</div>
                  <div className="line">③ 학교와 집과 휴대폰에서 같은 계정으로 쓸 수 있습니다.</div>
                  <div className="line">④ 거래 추가와 수정은 거래 내역 탭에서 처리합니다.</div>
                </div>
              </div>
            )}

            {activeTab === "holdings" && (
              <div className="card">
                <h2>보유 종목</h2>
                {summary.holdings.length === 0 ? <div className="muted">보유 종목이 없습니다.</div> : (
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>종목명</th><th>코드</th><th className="right">보유수량</th><th className="right">평균단가</th><th className="right">현재가</th><th className="right">평가금액</th><th className="right">평가손익</th><th className="right">수익률</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.holdings.map((row) => (
                          <tr key={row.ticker}>
                            <td className="bold">{row.stock_name}</td>
                            <td>{row.ticker}</td>
                            <td className="right">{Number(row.qty).toLocaleString("ko-KR")}</td>
                            <td className="right">{won(Math.round(row.avgPrice))}</td>
                            <td className="right">
                              <input className="priceInput" type="number" value={manualPrices[row.ticker] ?? 0} onChange={(e) => saveManualPrice(row.ticker, e.target.value)} />
                            </td>
                            <td className="right">{won(Math.round(row.valuation))}</td>
                            <td className={`right bold ${gainClass(row.gain)}`}>{signedWon(Math.round(row.gain))}</td>
                            <td className={`right bold ${gainClass(row.gainPct)}`}>{signedPct(row.gainPct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "trades" && (
              <div className="card">
                <div className="row between">
                  <h2>거래 내역</h2>
                  <button className="btn primary" onClick={openCreateDialog}>거래 추가</button>
                </div>
                {trades.length === 0 ? <div className="muted">아직 거래가 없습니다.</div> : (
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>날짜</th><th>종목명</th><th>코드</th><th>구분</th><th className="right">수량</th><th className="right">단가</th><th className="right">수수료</th><th className="right">세금</th><th>메모</th><th className="right">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.map((row) => (
                          <tr key={row.id}>
                            <td>{row.date}</td>
                            <td className="bold">{row.stock_name}</td>
                            <td>{row.ticker}</td>
                            <td><span className={`pill ${row.type}`}>{row.type === "buy" ? "매수" : "매도"}</span></td>
                            <td className="right">{Number(row.qty).toLocaleString("ko-KR")}</td>
                            <td className="right">{won(row.price)}</td>
                            <td className="right">{won(row.fee)}</td>
                            <td className="right">{won(row.tax)}</td>
                            <td>{row.memo || "-"}</td>
                            <td className="right">
                              <button className="mini" onClick={() => openEditDialog(row)}>수정</button>
                              <button className="mini danger" onClick={() => deleteTrade(row.id)}>삭제</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "realized" && (
              <div className="card">
                <h2>실현손익</h2>
                {summary.realizedRows.length === 0 ? <div className="muted">아직 매도 거래가 없습니다.</div> : (
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>매도일</th><th>종목명</th><th className="right">수량</th><th className="right">매도단가</th><th className="right">평균매입단가</th><th className="right">실현손익</th><th className="right">수익률</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.realizedRows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.date}</td>
                            <td className="bold">{row.stock_name}</td>
                            <td className="right">{Number(row.qty).toLocaleString("ko-KR")}</td>
                            <td className="right">{won(row.price)}</td>
                            <td className="right">{won(Math.round(row.avgPriceAtSell))}</td>
                            <td className={`right bold ${gainClass(row.realized)}`}>{signedWon(Math.round(row.realized))}</td>
                            <td className={`right bold ${gainClass(row.realizedPct)}`}>{signedPct(row.realizedPct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {dialogOpen && (
        <div className="modalBg" onClick={() => setDialogOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{form.id ? "거래 수정" : "거래 추가"}</h2>
            <div className="formGrid">
              <div>
                <label>거래일</label>
                <input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
              </div>
              <div>
                <label>구분</label>
                <div className="row gap8">
                  <button className={`btn ${form.type === "buy" ? "primary" : "secondary"}`} onClick={() => setForm((prev) => ({ ...prev, type: "buy" }))}>매수</button>
                  <button className={`btn ${form.type === "sell" ? "primary" : "secondary"}`} onClick={() => setForm((prev) => ({ ...prev, type: "sell" }))}>매도</button>
                </div>
              </div>
              <div>
                <label>빠른 선택</label>
                <select value={form.ticker} onChange={(e) => applyStockOption(e.target.value)}>
                  <option value="">직접 입력 또는 선택</option>
                  {STOCK_OPTIONS.map((item) => (
                    <option key={item.ticker} value={item.ticker}>{item.name} ({item.ticker})</option>
                  ))}
                </select>
              </div>
              <div>
                <label>종목명</label>
                <input value={form.stock_name} onChange={(e) => setForm((prev) => ({ ...prev, stock_name: e.target.value }))} placeholder="예: 삼성전자" />
              </div>
              <div>
                <label>종목코드</label>
                <input value={form.ticker} onChange={(e) => setForm((prev) => ({ ...prev, ticker: e.target.value }))} placeholder="예: 005930.KS / AAPL" />
              </div>
              <div>
                <label>수량</label>
                <input type="number" value={form.qty} onChange={(e) => setForm((prev) => ({ ...prev, qty: e.target.value }))} />
              </div>
              <div>
                <label>단가</label>
                <input type="number" value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))} />
              </div>
              <div>
                <label>수수료</label>
                <input type="number" value={form.fee} onChange={(e) => setForm((prev) => ({ ...prev, fee: e.target.value }))} />
              </div>
              <div>
                <label>세금</label>
                <input type="number" value={form.tax} onChange={(e) => setForm((prev) => ({ ...prev, tax: e.target.value }))} />
              </div>
              <div className="full">
                <label>메모</label>
                <input value={form.memo} onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))} placeholder="선택사항" />
              </div>
            </div>
            <div className="row end gap8" style={{marginTop: 16}}>
              <button className="btn secondary" onClick={() => setDialogOpen(false)}>취소</button>
              <button className="btn primary" onClick={saveTrade}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ title, value, cls = "" }) {
  return (
    <div className="metric">
      <div className="metricTitle">{title}</div>
      <div className={`metricValue ${cls}`}>{value}</div>
    </div>
  );
}
