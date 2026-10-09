import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
    Activity, AlertTriangle, Bot, BrainCircuit, CheckCircle2, Clock3,
    Pause, Play, RefreshCw, ShieldCheck, TrendingUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import GlassPanel from '../components/ui/GlassPanel';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function pct(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return `${(Number(value) * 100).toFixed(digits)}%`;
}

function dateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusTone(value) {
    if (value === 'submitted') return 'text-emerald-600 dark:text-emerald-400';
    if (value === 'submission_error' || value === 'skipped_market_closed') return 'text-amber-600 dark:text-amber-400';
    return 'text-gray-500 dark:text-slate-400';
}

export default function Agent() {
    const { token } = useAuth();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [notice, setNotice] = useState({ type: '', text: '' });

    const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
    const fetchStatus = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/agent/status`, auth);
            setStatus(response.data);
        } catch (error) {
            setNotice({ type: 'error', text: error.response?.data?.detail || 'Could not load the agent status.' });
        } finally {
            setLoading(false);
        }
    }, [auth]);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    const train = async () => {
        const refreshedKeys = window.confirm('Before training, confirm you have revoked the Alpaca and Binance keys posted in this chat and linked newly issued Alpaca paper credentials in API Integrations. Training will request SPY market history and will not place orders. Continue?');
        if (!refreshedKeys) return;
        setBusy('train');
        setNotice({ type: '', text: '' });
        try {
            const response = await axios.post(`${API}/agent/train`, {}, auth);
            setStatus(response.data.status);
            setNotice({ type: 'success', text: 'Policy trained and updated from Alpaca daily history. Review the holdout results below.' });
        } catch (error) {
            setNotice({ type: 'error', text: error.response?.data?.detail || 'Training failed.' });
        } finally {
            setBusy('');
        }
    };

    const saveConfig = async (enabled, autoSubmit) => {
        setBusy('config');
        setNotice({ type: '', text: '' });
        try {
            const response = await axios.put(`${API}/agent/config`, {
                enabled,
                auto_submit_paper: autoSubmit,
                acknowledge_dedicated_paper_account: autoSubmit,
            }, auth);
            setStatus(response.data);
            setNotice({ type: 'success', text: autoSubmit
                ? 'Daily paper execution is armed. The agent can place at most one capped SPY order per daily bar.'
                : enabled ? 'Daily analysis is enabled in dry-run mode.' : 'The agent has been paused.' });
        } catch (error) {
            setNotice({ type: 'error', text: error.response?.data?.detail || 'Could not update agent settings.' });
        } finally {
            setBusy('');
        }
    };

    const runNow = async () => {
        if (status?.auto_submit_paper && !window.confirm('The agent is armed. If the market is open, this run may submit a capped SPY order to Alpaca paper trading. Continue?')) return;
        setBusy('run');
        setNotice({ type: '', text: '' });
        try {
            const response = await axios.post(`${API}/agent/run`, {}, auth);
            setStatus(response.data.status);
            const decision = response.data.decision;
            setNotice({ type: 'success', text: `${decision.action} decision for ${decision.symbol} · ${decision.status}${decision.reason ? ` · ${decision.reason}` : ''}` });
        } catch (error) {
            setNotice({ type: 'error', text: error.response?.data?.detail || 'Agent run failed.' });
        } finally {
            setBusy('');
        }
    };

    if (loading) return <div className="py-16 text-center text-gray-500 dark:text-slate-400">Loading paper agent…</div>;

    const metrics = status?.training_metrics;
    const decisions = status?.recent_decisions || [];

    return (
        <div className="w-full animate-fade-in space-y-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="mb-2 flex items-center gap-2 text-cyan-600 dark:text-cyan-300">
                        <Bot className="h-5 w-5" />
                        <span className="text-xs font-semibold uppercase tracking-[0.2em]">Strategy Lab</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Paper Trading Agent</h1>
                    <p className="mt-2 max-w-2xl text-gray-500 dark:text-gray-400">
                        A small Q-learning policy studies daily SPY bars, logs its decisions, and updates its policy after the next bar.
                    </p>
                </div>
                <Button variant="outline" icon={RefreshCw} onClick={fetchStatus} disabled={busy !== ''} className="!w-auto !py-2 !px-4">
                    Refresh
                </Button>
            </header>

            {notice.text && (
                <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${notice.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>
                    {notice.type === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span>{notice.text}</span>
                </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <GlassPanel className="p-6 sm:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                                <Activity className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase tracking-widest">Agent status</span>
                            </div>
                            <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                                {status?.enabled ? (status?.auto_submit_paper ? 'Paper execution armed' : 'Daily dry-run enabled') : 'Paused'}
                            </h2>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status?.enabled
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {status?.enabled ? 'ACTIVE' : 'PAUSED'}
                        </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-gray-200/80 bg-white/50 p-4 dark:border-saipa-border dark:bg-slate-900/40">
                            <div className="text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400">Alpaca connection</div>
                            <div className="mt-2 flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                                {status?.alpaca_connected ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                                {status?.alpaca_connected ? 'Linked' : 'Not linked'}
                            </div>
                        </div>
                        <div className="rounded-xl border border-gray-200/80 bg-white/50 p-4 dark:border-saipa-border dark:bg-slate-900/40">
                            <div className="text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400">Learned policy</div>
                            <div className="mt-2 flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                                {status?.trained ? <BrainCircuit className="h-4 w-4 text-cyan-500" /> : <Clock3 className="h-4 w-4 text-gray-400" />}
                                {status?.trained ? 'Trained' : 'Needs training'}
                            </div>
                        </div>
                    </div>

                    {!status?.alpaca_connected && (
                        <Link to="/api-keys" className="mt-4 inline-flex text-sm font-medium text-cyan-700 hover:underline dark:text-cyan-300">
                            Link an Alpaca account →
                        </Link>
                    )}

                    <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-200/70 pt-5 dark:border-saipa-border">
                        <Button onClick={train} isLoading={busy === 'train'} disabled={busy !== '' || !status?.alpaca_connected} icon={BrainCircuit} className="!w-auto !px-4">
                            {status?.trained ? 'Train & update policy' : 'Train policy'}
                        </Button>
                        <Button variant="outline" onClick={runNow} isLoading={busy === 'run'} disabled={busy !== '' || !status?.trained || !status?.alpaca_connected} icon={Play} className="!w-auto !px-4">
                            Run once now
                        </Button>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-slate-400">
                        Training uses historical daily bars and a later holdout period. It updates the policy; it does not place an order.
                    </p>
                </GlassPanel>

                <GlassPanel className="p-6 sm:p-7">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-semibold uppercase tracking-widest">Fixed safety limits</span>
                    </div>
                    <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-slate-300">
                        <div className="flex justify-between gap-3"><span>Broker mode</span><strong className="text-emerald-700 dark:text-emerald-400">Alpaca paper only</strong></div>
                        <div className="flex justify-between gap-3"><span>Instrument</span><strong>SPY only</strong></div>
                        <div className="flex justify-between gap-3"><span>Maximum exposure</span><strong>5% of account equity</strong></div>
                        <div className="flex justify-between gap-3"><span>Maximum order</span><strong>$100</strong></div>
                        <div className="flex justify-between gap-3"><span>Order frequency</span><strong>One per daily bar</strong></div>
                    </div>
                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                        Revoke the broker keys posted in chat and link fresh credentials before training. Use a dedicated Alpaca paper account: the agent treats its entire SPY position as managed by this strategy. No Binance or live-trading route is used.
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                        {status?.enabled ? (
                            <Button variant="outline" icon={Pause} disabled={busy !== ''} onClick={() => saveConfig(false, false)} className="!w-auto !px-4">
                                Pause agent
                            </Button>
                        ) : (
                            <Button variant="outline" icon={Play} disabled={busy !== '' || !status?.trained || !status?.alpaca_connected} onClick={() => saveConfig(true, false)} className="!w-auto !px-4">
                                Enable daily dry-run
                            </Button>
                        )}
                        {!status?.auto_submit_paper ? (
                            <Button disabled={busy !== '' || !status?.trained || !status?.alpaca_connected} onClick={() => {
                                const accepted = window.confirm('Enable daily SPY orders in Alpaca paper trading? Confirm this is a dedicated paper account and that the agent may manage its entire SPY position. The live-trading API is not used.');
                                if (accepted) saveConfig(true, true);
                            }} className="!w-auto !px-4">
                                Enable paper orders
                            </Button>
                        ) : (
                            <Button variant="outline" icon={Pause} disabled={busy !== ''} onClick={() => saveConfig(true, false)} className="!w-auto !px-4">
                                Disable paper orders
                            </Button>
                        )}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-slate-400">
                        The schedule runs during US market hours while this backend is running. Both daily scheduling and order submission start off.
                    </p>
                </GlassPanel>
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <GlassPanel className="p-6 sm:p-7">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-widest">Holdout review</span>
                    </div>
                    {metrics ? (
                        <>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-xl bg-gray-50 p-4 dark:bg-slate-900/60">
                                    <div className="text-xs text-gray-500 dark:text-slate-400">Agent return</div>
                                    <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{pct(metrics.holdout_agent_return)}</div>
                                </div>
                                <div className="rounded-xl bg-gray-50 p-4 dark:bg-slate-900/60">
                                    <div className="text-xs text-gray-500 dark:text-slate-400">5% exposure baseline</div>
                                    <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{pct(metrics.holdout_5pct_exposure_benchmark_return)}</div>
                                </div>
                                <div className="rounded-xl bg-gray-50 p-4 dark:bg-slate-900/60">
                                    <div className="text-xs text-gray-500 dark:text-slate-400">Maximum drawdown</div>
                                    <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{pct(metrics.holdout_max_drawdown)}</div>
                                </div>
                                <div className="rounded-xl bg-gray-50 p-4 dark:bg-slate-900/60">
                                    <div className="text-xs text-gray-500 dark:text-slate-400">Training / holdout bars</div>
                                    <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{metrics.training_bars} / {metrics.holdout_bars}</div>
                                </div>
                            </div>
                            <p className="mt-4 text-xs leading-5 text-gray-500 dark:text-slate-400">
                                Historical simulation, before real execution effects. It is a review metric, not a performance promise. Policy last trained {dateTime(status?.trained_at)}.
                            </p>
                        </>
                    ) : (
                        <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">Train the policy to see its chronological holdout comparison.</p>
                    )}
                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        {status?.pending_reviews || 0} decision(s) awaiting the next daily-bar review
                    </div>
                </GlassPanel>

                <GlassPanel className="p-6 sm:p-7">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                                <BrainCircuit className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase tracking-widest">Decision journal</span>
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Daily policy choices and their later simulated reward.</p>
                        </div>
                        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300">{decisions.length} runs</span>
                    </div>
                    {decisions.length ? (
                        <div className="max-h-[25rem] overflow-auto rounded-xl border border-gray-200/80 dark:border-saipa-border">
                            <table className="w-full min-w-[620px] text-left text-sm">
                                <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:bg-slate-900 dark:text-slate-400">
                                    <tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Exposure</th><th className="px-3 py-3">Order</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Review</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {decisions.map((decision) => (
                                        <tr key={decision.id} className="text-gray-700 dark:text-slate-300">
                                            <td className="whitespace-nowrap px-3 py-3">{decision.bar_date}</td>
                                            <td className="px-3 py-3 capitalize">{decision.action}</td>
                                            <td className="px-3 py-3">{pct(decision.target_exposure)}</td>
                                            <td className="whitespace-nowrap px-3 py-3">{decision.order_side} {decision.order_notional ? `$${Number(decision.order_notional).toFixed(2)}` : ''}</td>
                                            <td className={`whitespace-nowrap px-3 py-3 ${statusTone(decision.status)}`}>{decision.status.replaceAll('_', ' ')}</td>
                                            <td className="whitespace-nowrap px-3 py-3">{decision.reward === null ? 'Pending' : pct(decision.reward, 3)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500 dark:border-slate-700 dark:text-slate-400">
                            No decisions yet. Train a policy, then run it once or enable daily analysis.
                        </div>
                    )}
                </GlassPanel>
            </div>
        </div>
    );
}
