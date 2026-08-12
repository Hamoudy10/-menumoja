import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gift, ListChecks, Users, BadgePercent, Plus, Trash2, Edit3, X, RefreshCw, Star, TicketCheck, Minus, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as loyaltyApi from '@/api/loyalty'

const TRIGGERS = ['VISIT_COUNT', 'SPEND_THRESHOLD', 'ITEM_COUNT', 'CATEGORY_PURCHASE', 'INACTIVITY', 'BIRTHDAY']
const REWARD_TYPES = ['FREE_ITEM', 'DISCOUNT', 'FIXED_AMOUNT', 'PERCENTAGE', 'POINTS', 'BUNDLE']

const emptyRule = {
  name: '', triggerType: 'VISIT_COUNT', triggerValue: '', rewardType: 'FREE_ITEM', rewardValue: '',
  rewardItemId: '', rewardQuantity: '', usageLimit: '1', isActive: true,
}

export default function LoyaltyPage() {
  const [tab, setTab] = useState<'program' | 'rules' | 'accounts' | 'rewards'>('program')
  const [loading, setLoading] = useState(true)
  const [program, setProgram] = useState<any>(null)
  const [rules, setRules] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [rewards, setRewards] = useState<any[]>([])
  const [menuItems, setMenuItems] = useState<any[]>([])

  const [showRuleModal, setShowRuleModal] = useState(false)
  const [editingRule, setEditingRule] = useState<any | null>(null)
  const [ruleForm, setRuleForm] = useState({ ...emptyRule })
  const [savingRule, setSavingRule] = useState(false)

  const [selectedAccount, setSelectedAccount] = useState<any | null>(null)
  const [accountDetail, setAccountDetail] = useState<any | null>(null)
  const [adjustPoints, setAdjustPoints] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [programRes, rulesRes, accountsRes, rewardsRes, menuRes] = await Promise.all([
        loyaltyApi.fetchProgram(),
        loyaltyApi.fetchRules(),
        loyaltyApi.fetchAccounts(),
        loyaltyApi.fetchRewards(),
        import('@/api/menu').then((m) => m.fetchCategories()),
      ])
      setProgram(programRes)
      setRules(Array.isArray(rulesRes) ? rulesRes : [])
      setAccounts(Array.isArray(accountsRes) ? accountsRes : [])
      setRewards(Array.isArray(rewardsRes) ? rewardsRes : [])
      const cats = Array.isArray(menuRes) ? menuRes : menuRes?.categories || []
      setMenuItems(cats.flatMap((c: any) => c.items || []))
    } catch { showErrorToast('Failed to load loyalty data') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const saveProgram = async () => {
    try {
      await loyaltyApi.updateProgram({
        name: program.name,
        pointsPerKes: Number(program.pointsPerKes),
        pointsExpiryDays: program.pointsExpiryDays ? Number(program.pointsExpiryDays) : null,
        isActive: program.isActive,
      })
      showSuccessToast('Program saved')
    } catch { showErrorToast('Failed to save program') }
  }

  const openRuleModal = (rule: any | null) => {
    setEditingRule(rule)
    setRuleForm(rule ? {
      name: rule.name, triggerType: rule.triggerType, triggerValue: String(rule.triggerValue),
      rewardType: rule.rewardType, rewardValue: String(rule.rewardValue),
      rewardItemId: rule.rewardItemId || '', rewardQuantity: rule.rewardQuantity ? String(rule.rewardQuantity) : '',
      usageLimit: String(rule.usageLimit), isActive: rule.isActive,
    } : { ...emptyRule })
    setShowRuleModal(true)
  }

  const saveRule = async () => {
    if (!ruleForm.name.trim()) { showErrorToast('Rule name is required'); return }
    setSavingRule(true)
    try {
      const payload = {
        name: ruleForm.name.trim(),
        triggerType: ruleForm.triggerType,
        triggerValue: ruleForm.triggerType === 'VISIT_COUNT' || ruleForm.triggerType === 'SPEND_THRESHOLD' || ruleForm.triggerType === 'INACTIVITY'
          ? Number(ruleForm.triggerValue)
          : ruleForm.triggerValue,
        rewardType: ruleForm.rewardType,
        rewardValue: ruleForm.rewardType === 'POINTS' || ruleForm.rewardType === 'DISCOUNT' || ruleForm.rewardType === 'FIXED_AMOUNT' || ruleForm.rewardType === 'PERCENTAGE'
          ? Number(ruleForm.rewardValue)
          : ruleForm.rewardValue,
        rewardItemId: ruleForm.rewardItemId || undefined,
        rewardQuantity: ruleForm.rewardQuantity ? Number(ruleForm.rewardQuantity) : undefined,
        usageLimit: Number(ruleForm.usageLimit) || 1,
        isActive: ruleForm.isActive,
      }
      if (editingRule) {
        await loyaltyApi.updateRule(editingRule.id, payload)
        showSuccessToast('Rule updated')
      } else {
        await loyaltyApi.createRule(payload)
        showSuccessToast('Rule created')
      }
      setShowRuleModal(false)
      load()
    } catch { showErrorToast('Failed to save rule') }
    finally { setSavingRule(false) }
  }

  const toggleRule = async (rule: any) => {
    try {
      await loyaltyApi.updateRule(rule.id, { isActive: !rule.isActive })
      showSuccessToast(rule.isActive ? 'Rule deactivated' : 'Rule activated')
      load()
    } catch { showErrorToast('Failed to update rule') }
  }

  const deleteRule = async (rule: any) => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return
    try {
      await loyaltyApi.deleteRule(rule.id)
      showSuccessToast('Rule deleted')
      load()
    } catch { showErrorToast('Failed to delete rule') }
  }

  const openAccount = async (account: any) => {
    setSelectedAccount(account)
    setAdjustPoints('')
    setAdjustReason('')
    try {
      const detail = await loyaltyApi.getAccount(account.customer.id)
      setAccountDetail(detail)
    } catch { showErrorToast('Failed to load account') }
  }

  const submitAdjust = async () => {
    if (!selectedAccount || !adjustPoints || !adjustReason.trim()) { showErrorToast('Points and reason required'); return }
    try {
      await loyaltyApi.adjustPoints(selectedAccount.customer.id, Number(adjustPoints), adjustReason.trim())
      showSuccessToast('Points adjusted')
      openAccount(selectedAccount)
      load()
    } catch (err: any) { showErrorToast(err?.response?.data?.message || 'Adjustment failed') }
  }

  const redeemRewardRow = async (reward: any) => {
    if (!confirm(`Redeem ${reward.rewardType} reward (${reward.note || reward.rewardValue})?`)) return
    try {
      await loyaltyApi.redeemReward(reward.id)
      showSuccessToast('Reward redeemed')
      load()
      if (selectedAccount) openAccount(selectedAccount)
    } catch (err: any) { showErrorToast(err?.response?.data?.message || 'Redemption failed') }
  }

  const tabs = [
    { key: 'program' as const, label: 'Program', icon: <Gift className="h-4 w-4" /> },
    { key: 'rules' as const, label: 'Rules', icon: <ListChecks className="h-4 w-4" />, badge: rules.filter((r) => r.isActive).length || undefined },
    { key: 'accounts' as const, label: 'Accounts', icon: <Users className="h-4 w-4" />, badge: accounts.length || undefined },
    { key: 'rewards' as const, label: 'Rewards', icon: <TicketCheck className="h-4 w-4" />, badge: rewards.filter((r) => r.status === 'ISSUED').length || undefined },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Smart Loyalty</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Points, rules and rewards — with abuse prevention</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'rules' && <Button size="sm" onClick={() => openRuleModal(null)}><Plus className="h-3.5 w-3.5" /> New Rule</Button>}
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-secondary text-white' : 'bg-white dark:bg-primary-light border border-white/10 text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.icon} {t.label}
            {t.badge ? <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-secondary/10 text-secondary'}`}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="card" className="h-28" />)}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {tab === 'program' && program && (
            <motion.div key="program" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5 max-w-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">Points Program</h3>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-text-secondary">Active</span>
                  <input type="checkbox" checked={!!program.isActive} onChange={(e) => setProgram({ ...program, isActive: e.target.checked })} className="w-4 h-4 accent-[var(--color-secondary)]" />
                </label>
              </div>
              <div className="space-y-3">
                <Input label="Program name" value={program.name || ''} onChange={(e) => setProgram({ ...program, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Points per KES" type="number" value={String(program.pointsPerKes ?? 1)} onChange={(e) => setProgram({ ...program, pointsPerKes: e.target.value })} />
                  <Input label="Points expiry (days, blank = never)" type="number" value={program.pointsExpiryDays ? String(program.pointsExpiryDays) : ''} onChange={(e) => setProgram({ ...program, pointsExpiryDays: e.target.value })} />
                </div>
                <p className="text-xs text-text-secondary">Customers earn floor(spend ÷ points-per-KES) points on every confirmed payment. Points are stored in an immutable ledger.</p>
                <Button onClick={saveProgram}>Save Program</Button>
              </div>
            </motion.div>
          )}

          {tab === 'rules' && (
            <motion.div key="rules" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {rules.length === 0 ? (
                <EmptyState icon={<ListChecks className="h-10 w-10" />} title="No loyalty rules" description="Create rules like “5th visit gets a free item” or “Spend KES 10,000 → 10% off”" />
              ) : rules.map((rule) => (
                <div key={rule.id} className={`rounded-2xl bg-white dark:bg-primary-light border p-4 ${rule.isActive ? 'border-white/10' : 'border-white/10 opacity-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-text-primary dark:text-white truncate">{rule.name}</p>
                      <p className="font-accent text-xs text-text-secondary mt-0.5">
                        When <span className="font-bold">{rule.triggerType.replace(/_/g, ' ').toLowerCase()} ≥ {rule.triggerValue}</span>
                        {rule.triggerType === 'ITEM_COUNT' && rule.rewardQuantity ? ` (${rule.rewardQuantity} needed)` : ''}
                        {' → '}reward <span className="font-bold">{rule.rewardType.replace(/_/g, ' ').toLowerCase()}</span> {rule.rewardType !== 'POINTS' && rule.rewardType !== 'BUNDLE' ? `of ${rule.rewardValue}` : ''}
                        {rule.rewardType === 'POINTS' ? `: ${rule.rewardValue} pts` : ''}
                        {' · '}max {rule.usageLimit}/customer
                        {rule.startsAt || rule.endsAt ? ` · ${rule.startsAt ? new Date(rule.startsAt).toLocaleDateString('en-KE') : '…'} → ${rule.endsAt ? new Date(rule.endsAt).toLocaleDateString('en-KE') : '…'}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant={rule.isActive ? 'success' : 'default'} size="sm">{rule.isActive ? 'Active' : 'Off'}</Badge>
                      <button onClick={() => toggleRule(rule)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary" title={rule.isActive ? 'Deactivate' : 'Activate'}><Star className="h-3.5 w-3.5" /></button>
                      <button onClick={() => openRuleModal(rule)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary"><Edit3 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteRule(rule)} className="p-1.5 rounded-lg hover:bg-red-50 text-text-secondary hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {tab === 'accounts' && (
            <motion.div key="accounts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
              {accounts.length === 0 ? (
                <EmptyState icon={<Users className="h-10 w-10" />} title="No loyalty accounts yet" description="Accounts are created when customers earn their first points" />
              ) : (
                <div className="space-y-1.5">
                  {accounts.map((acc) => (
                    <button key={acc.id} onClick={() => openAccount(acc)} className="w-full flex items-center justify-between gap-3 py-2 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <div className="text-left min-w-0">
                        <p className="font-body text-sm font-medium text-text-primary dark:text-white truncate">{acc.customer?.name || 'Anonymous'}</p>
                        <p className="font-accent text-xs text-text-secondary">{acc.customer?.phone}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-heading text-base font-bold text-secondary">{acc.pointsBalance} pts</p>
                        <p className="text-[10px] text-text-secondary">{acc.totalEarned} earned · {acc.totalRedeemed} redeemed</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'rewards' && (
            <motion.div key="rewards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {rewards.length === 0 ? (
                <EmptyState icon={<TicketCheck className="h-10 w-10" />} title="No rewards issued" description="Rewards are issued automatically when rules match a paid order" />
              ) : rewards.map((reward) => (
                <div key={reward.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-text-primary dark:text-white">
                      {reward.rewardType.replace(/_/g, ' ')}
                      {reward.rewardType === 'POINTS' ? ` · ${reward.rewardValue} pts` : reward.rewardType === 'DISCOUNT' || reward.rewardType === 'FIXED_AMOUNT' || reward.rewardType === 'PERCENTAGE' ? ` · ${reward.rewardValue}` : ''}
                    </p>
                    <p className="font-accent text-xs text-text-secondary mt-0.5">{reward.note || 'Rule reward'} · issued {new Date(reward.issuedAt).toLocaleDateString('en-KE')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={reward.status === 'ISSUED' ? 'warning' : reward.status === 'REDEEMED' ? 'success' : 'default'} size="sm">{reward.status}</Badge>
                    {reward.status === 'ISSUED' && (
                      <Button size="sm" onClick={() => redeemRewardRow(reward)}>Redeem</Button>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Rule modal */}
      {showRuleModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowRuleModal(false)} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-primary-light rounded-2xl p-6 w-full max-w-md shadow-soft border border-white/10 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-lg text-text-primary dark:text-white">{editingRule ? 'Edit Rule' : 'New Loyalty Rule'}</h3>
                <button onClick={() => setShowRuleModal(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <Input label="Rule name" value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} placeholder="e.g. 5th Visit Free Chai" />
                <Select label="Trigger" options={TRIGGERS.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))} value={ruleForm.triggerType} onChange={(e) => setRuleForm({ ...ruleForm, triggerType: e.target.value })} />
                {ruleForm.triggerType === 'ITEM_COUNT' ? (
                  <>
                    <Select label="Item" options={[{ value: '', label: 'Select item…' }, ...menuItems.map((i: any) => ({ value: i.id, label: i.name }))]} value={ruleForm.rewardItemId} onChange={(e) => setRuleForm({ ...ruleForm, rewardItemId: e.target.value })} />
                    <Input label="Quantity needed" type="number" value={ruleForm.rewardQuantity} onChange={(e) => setRuleForm({ ...ruleForm, rewardQuantity: e.target.value })} />
                  </>
                ) : ruleForm.triggerType === 'CATEGORY_PURCHASE' || ruleForm.triggerType === 'BIRTHDAY' ? (
                  <Input label={ruleForm.triggerType === 'CATEGORY_PURCHASE' ? 'Category name' : 'No value needed (birthday match)'} value={ruleForm.triggerValue} onChange={(e) => setRuleForm({ ...ruleForm, triggerValue: e.target.value })} placeholder={ruleForm.triggerType === 'CATEGORY_PURCHASE' ? 'e.g. Beverages' : ''} disabled={ruleForm.triggerType === 'BIRTHDAY'} />
                ) : (
                  <Input label={ruleForm.triggerType === 'VISIT_COUNT' ? 'Number of visits' : ruleForm.triggerType === 'SPEND_THRESHOLD' ? 'Minimum total spend (KES)' : 'Days without a visit'} type="number" value={ruleForm.triggerValue} onChange={(e) => setRuleForm({ ...ruleForm, triggerValue: e.target.value })} />
                )}
                <Select label="Reward" options={REWARD_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))} value={ruleForm.rewardType} onChange={(e) => setRuleForm({ ...ruleForm, rewardType: e.target.value })} />
                {ruleForm.rewardType === 'FREE_ITEM' || ruleForm.rewardType === 'BUNDLE' ? (
                  <Select label={ruleForm.rewardType === 'FREE_ITEM' ? 'Free item' : 'Bundle item'} options={[{ value: '', label: 'Select item…' }, ...menuItems.map((i: any) => ({ value: i.id, label: i.name }))]} value={ruleForm.rewardItemId} onChange={(e) => setRuleForm({ ...ruleForm, rewardItemId: e.target.value })} />
                ) : (
                  <Input label={ruleForm.rewardType === 'POINTS' ? 'Points to credit' : ruleForm.rewardType === 'PERCENTAGE' ? 'Discount percent' : ruleForm.rewardType === 'FIXED_AMOUNT' ? 'Amount (KES)' : 'Discount value'} type="number" value={ruleForm.rewardValue} onChange={(e) => setRuleForm({ ...ruleForm, rewardValue: e.target.value })} />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Max uses per customer" type="number" value={ruleForm.usageLimit} onChange={(e) => setRuleForm({ ...ruleForm, usageLimit: e.target.value })} />
                  <label className="flex items-end gap-2 text-sm pb-2">
                    <span className="text-text-secondary">Active</span>
                    <input type="checkbox" checked={ruleForm.isActive} onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.checked })} className="w-4 h-4 accent-[var(--color-secondary)]" />
                  </label>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button fullWidth loading={savingRule} onClick={saveRule}>{editingRule ? 'Save Changes' : 'Create Rule'}</Button>
                  <Button variant="ghost" onClick={() => setShowRuleModal(false)}>Cancel</Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Account drawer */}
      <AnimatePresence>
        {selectedAccount && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedAccount(null)} />}
        {selectedAccount && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-primary-light border-l border-white/10 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-primary-light border-b border-black/5 dark:border-white/10 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white">{selectedAccount.customer?.name || 'Anonymous'}</h2>
                <p className="font-accent text-xs text-text-secondary">{selectedAccount.customer?.phone}</p>
              </div>
              <button onClick={() => setSelectedAccount(null)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-5">
              <div className="rounded-xl bg-secondary/10 p-4 text-center">
                <p className="font-heading text-3xl font-bold text-secondary">{accountDetail?.account?.pointsBalance ?? selectedAccount.pointsBalance} pts</p>
                <p className="text-xs text-text-secondary mt-1">{accountDetail?.account?.totalEarned ?? 0} earned · {accountDetail?.account?.totalRedeemed ?? 0} redeemed</p>
              </div>

              <div className="rounded-xl border border-black/5 dark:border-white/10 p-3 space-y-2">
                <p className="font-accent text-xs text-text-secondary uppercase tracking-wider">Manual adjustment (audited)</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="+/- points" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} />
                  <Input placeholder="Reason" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
                </div>
                <Button size="sm" fullWidth onClick={submitAdjust}><Minus className="h-3.5 w-3.5" /> Apply Adjustment</Button>
              </div>

              <div>
                <p className="font-accent text-xs text-text-secondary uppercase tracking-wider mb-2">Transactions</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(accountDetail?.transactions || []).length === 0 ? (
                    <p className="text-xs text-text-secondary">No transactions yet</p>
                  ) : accountDetail.transactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between text-xs py-1 border-b border-black/5 dark:border-white/5 last:border-0">
                      <span className="text-text-primary dark:text-white truncate">{tx.reason}</span>
                      <span className={`font-bold shrink-0 ml-2 ${tx.points >= 0 ? 'text-success' : 'text-red-500'}`}>{tx.points >= 0 ? '+' : ''}{tx.points}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-accent text-xs text-text-secondary uppercase tracking-wider mb-2">Rewards</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(accountDetail?.rewards || []).length === 0 ? (
                    <p className="text-xs text-text-secondary">No rewards</p>
                  ) : accountDetail.rewards.map((reward: any) => (
                    <div key={reward.id} className="flex items-center justify-between text-xs py-1 border-b border-black/5 dark:border-white/5 last:border-0">
                      <span className="text-text-primary dark:text-white truncate">{reward.rewardType.replace(/_/g, ' ')} · {reward.note || reward.rewardValue}</span>
                      <span className="shrink-0 ml-2"><Badge variant={reward.status === 'ISSUED' ? 'warning' : reward.status === 'REDEEMED' ? 'success' : 'default'} size="sm">{reward.status}</Badge></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
