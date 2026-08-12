import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, FileText, Megaphone, Plus, Trash2, Edit3, X, RefreshCw, Send, ShieldCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as whatsappApi from '@/api/whatsapp'

const SEGMENTS = ['ALL', 'VIP', 'Frequent', 'New', 'Dormant', 'High spender', 'Lunch customer', 'Dinner customer', 'Weekend customer', 'Category-loyal']

export default function WhatsAppPage() {
  const [tab, setTab] = useState<'settings' | 'templates' | 'campaigns'>('settings')
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>({ enabled: false, businessPhone: '' })
  const [templates, setTemplates] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])

  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null)
  const [templateForm, setTemplateForm] = useState({ name: '', content: '' })

  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [campaignForm, setCampaignForm] = useState({ name: '', audienceSegment: 'ALL', templateId: '', message: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, templatesRes, campaignsRes] = await Promise.all([
        whatsappApi.fetchSettings(),
        whatsappApi.fetchTemplates(),
        whatsappApi.fetchCampaigns(),
      ])
      setSettings(settingsRes || { enabled: false, businessPhone: '' })
      setTemplates(Array.isArray(templatesRes) ? templatesRes : [])
      setCampaigns(Array.isArray(campaignsRes) ? campaignsRes : [])
    } catch { showErrorToast('Failed to load WhatsApp data') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const saveSettings = async () => {
    try {
      await whatsappApi.saveSettings({ enabled: settings.enabled, businessPhone: settings.businessPhone || undefined })
      showSuccessToast(settings.enabled ? 'WhatsApp enabled' : 'WhatsApp disabled')
      load()
    } catch { showErrorToast('Failed to save settings') }
  }

  const openTemplateModal = (tpl: any | null) => {
    setEditingTemplate(tpl)
    setTemplateForm(tpl ? { name: tpl.name, content: tpl.content } : { name: '', content: '' })
    setShowTemplateModal(true)
  }

  const saveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.content.trim()) { showErrorToast('Name and content are required'); return }
    try {
      if (editingTemplate) {
        await whatsappApi.updateTemplate(editingTemplate.id, templateForm)
        showSuccessToast('Template updated')
      } else {
        await whatsappApi.createTemplate(templateForm)
        showSuccessToast('Template created')
      }
      setShowTemplateModal(false)
      load()
    } catch { showErrorToast('Failed to save template') }
  }

  const deleteTemplate = async (tpl: any) => {
    if (!confirm(`Delete template "${tpl.name}"?`)) return
    try {
      await whatsappApi.deleteTemplate(tpl.id)
      showSuccessToast('Template deleted')
      load()
    } catch { showErrorToast('Failed to delete template') }
  }

  const createCampaign = async () => {
    if (!campaignForm.name.trim()) { showErrorToast('Campaign name is required'); return }
    if (!campaignForm.templateId && !campaignForm.message.trim()) { showErrorToast('Add a template or custom message'); return }
    try {
      await whatsappApi.createCampaign({
        name: campaignForm.name.trim(),
        audienceSegment: campaignForm.audienceSegment === 'ALL' ? null : campaignForm.audienceSegment,
        templateId: campaignForm.templateId || undefined,
        message: campaignForm.message.trim() || undefined,
      })
      showSuccessToast('Campaign created')
      setShowCampaignModal(false)
      setCampaignForm({ name: '', audienceSegment: 'ALL', templateId: '', message: '' })
      load()
    } catch { showErrorToast('Failed to create campaign') }
  }

  const sendCampaign = async (campaign: any) => {
    if (!confirm(`Send campaign "${campaign.name}" to its audience now? Only consenting customers are included.`)) return
    try {
      await whatsappApi.sendCampaign(campaign.id)
      showSuccessToast('Campaign sent')
      load()
    } catch (err: any) { showErrorToast(err?.response?.data?.message || 'Failed to send campaign') }
  }

  const deleteCampaign = async (campaign: any) => {
    if (!confirm(`Delete campaign "${campaign.name}"?`)) return
    try {
      await whatsappApi.deleteCampaign(campaign.id)
      showSuccessToast('Campaign deleted')
      load()
    } catch { showErrorToast('Failed to delete campaign') }
  }

  const tabs = [
    { key: 'settings' as const, label: 'Settings', icon: <MessageCircle className="h-4 w-4" /> },
    { key: 'templates' as const, label: 'Templates', icon: <FileText className="h-4 w-4" />, badge: templates.length || undefined },
    { key: 'campaigns' as const, label: 'Campaigns', icon: <Megaphone className="h-4 w-4" />, badge: campaigns.filter((c) => c.status === 'SENT').length || undefined },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">WhatsApp</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Customer notifications and campaigns — consent-gated</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'templates' && <Button size="sm" onClick={() => openTemplateModal(null)}><Plus className="h-3.5 w-3.5" /> New Template</Button>}
          {tab === 'campaigns' && <Button size="sm" onClick={() => setShowCampaignModal(true)}><Plus className="h-3.5 w-3.5" /> New Campaign</Button>}
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
          {tab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5 max-w-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">Channel Settings</h3>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-text-secondary">Enabled</span>
                  <input type="checkbox" checked={!!settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} className="w-4 h-4 accent-[var(--color-secondary)]" />
                </label>
              </div>
              <div className="space-y-3">
                <Input label="Business WhatsApp number" value={settings.businessPhone || ''} onChange={(e) => setSettings({ ...settings, businessPhone: e.target.value })} placeholder="e.g. 254712345678" />
                <Button onClick={saveSettings}>Save Settings</Button>
                <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3 space-y-2 text-xs text-text-secondary">
                  <p className="flex items-center gap-1.5 font-semibold"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Consent gate</p>
                  <p>Messages are only sent to customers who gave marketing consent and have not opted out. Preferred-channel preferences are respected.</p>
                  <p className="flex items-center gap-1.5 font-semibold"><ShieldOff className="h-3.5 w-3.5 text-amber-500" /> Delivery tracking</p>
                  <p>Only SENT/FAILED is recorded. Delivery receipts require Meta webhook wiring — we never claim delivered/open stats we don't have.</p>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'templates' && (
            <motion.div key="templates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.length === 0 ? (
                <div className="md:col-span-2"><EmptyState icon={<FileText className="h-10 w-10" />} title="No templates yet" description="Create templates with {{placeholders}} like {{customerName}}, {{orderNumber}} or {{amount}}" /></div>
              ) : templates.map((tpl) => (
                <div key={tpl.id} className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-heading font-bold text-text-primary dark:text-white">{tpl.name}</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openTemplateModal(tpl)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary"><Edit3 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteTemplate(tpl)} className="p-1.5 rounded-lg hover:bg-red-50 text-text-secondary hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <p className="font-accent text-xs text-text-secondary bg-black/5 dark:bg-white/5 rounded-lg p-2.5 whitespace-pre-wrap">{tpl.content}</p>
                </div>
              ))}
            </motion.div>
          )}

          {tab === 'campaigns' && (
            <motion.div key="campaigns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {campaigns.length === 0 ? (
                <EmptyState icon={<Megaphone className="h-10 w-10" />} title="No campaigns yet" description="Create a campaign to promote to a customer segment" />
              ) : campaigns.map((campaign) => (
                <div key={campaign.id} className={`rounded-2xl bg-white dark:bg-primary-light border p-4 ${campaign.status === 'SENT' ? 'border-success/30' : 'border-white/10'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-text-primary dark:text-white truncate">{campaign.name}</p>
                      <p className="font-accent text-xs text-text-secondary mt-0.5">
                        Audience: <span className="font-bold">{campaign.audienceSegment || 'ALL consenting'}</span>
                        {campaign.sentAt ? ` · sent ${new Date(campaign.sentAt).toLocaleDateString('en-KE')}` : ` · created ${new Date(campaign.createdAt).toLocaleDateString('en-KE')}`}
                      </p>
                      {campaign.status === 'SENT' && (
                        <p className="font-accent text-xs text-text-secondary mt-0.5">
                          {campaign.totalRecipients} recipient(s) · <span className="text-success">{campaign.sentCount} sent</span> · <span className="text-red-500">{campaign.failedCount} failed</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={campaign.status === 'SENT' ? 'success' : campaign.status === 'SCHEDULED' ? 'warning' : 'default'} size="sm">{campaign.status}</Badge>
                      {(campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED') && (
                        <Button size="sm" onClick={() => sendCampaign(campaign)}><Send className="h-3.5 w-3.5" /> Send</Button>
                      )}
                      <button onClick={() => deleteCampaign(campaign)} className="p-1.5 rounded-lg hover:bg-red-50 text-text-secondary hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Template modal */}
      {showTemplateModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowTemplateModal(false)} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-primary-light rounded-2xl p-6 w-full max-w-md shadow-soft border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-lg text-text-primary dark:text-white">{editingTemplate ? 'Edit Template' : 'New Template'}</h3>
                <button onClick={() => setShowTemplateModal(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <Input label="Name" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="e.g. order_confirm" />
                <div>
                  <label className="block font-accent text-sm font-medium text-text-primary dark:text-white/90 mb-1.5">Content</label>
                  <textarea
                    value={templateForm.content}
                    onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                    rows={5}
                    className="w-full rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2.5 font-body text-sm text-text-primary dark:text-white focus:outline-none focus:ring-2 focus:border-secondary focus:ring-secondary/20"
                    placeholder="Hello {{customerName}}, your order {{orderNumber}} is ready!"
                  />
                  <p className="text-[11px] text-text-secondary mt-1">Placeholders: {'{{customerName}}'} {'{{orderNumber}}'} {'{{amount}}'} {'{{prepMinutes}}'} {'{{receiptNo}}'} {'{{restaurantName}}'}</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button fullWidth onClick={saveTemplate}>{editingTemplate ? 'Save Changes' : 'Create Template'}</Button>
                  <Button variant="ghost" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Campaign modal */}
      {showCampaignModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowCampaignModal(false)} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-primary-light rounded-2xl p-6 w-full max-w-md shadow-soft border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-lg text-text-primary dark:text-white">New Campaign</h3>
                <button onClick={() => setShowCampaignModal(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <Input label="Campaign name" value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} placeholder="e.g. Weekend Win-Back" />
                <Select label="Audience segment" options={SEGMENTS.map((s) => ({ value: s, label: s === 'ALL' ? 'ALL consenting customers' : s }))} value={campaignForm.audienceSegment} onChange={(e) => setCampaignForm({ ...campaignForm, audienceSegment: e.target.value })} />
                <Select label="Template (optional)" options={[{ value: '', label: 'Custom message below…' }, ...templates.map((t) => ({ value: t.id, label: t.name }))]} value={campaignForm.templateId} onChange={(e) => setCampaignForm({ ...campaignForm, templateId: e.target.value })} />
                <textarea
                  value={campaignForm.message}
                  onChange={(e) => setCampaignForm({ ...campaignForm, message: e.target.value })}
                  rows={4}
                  className="w-full rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2.5 font-body text-sm text-text-primary dark:text-white focus:outline-none focus:ring-2 focus:border-secondary focus:ring-secondary/20"
                  placeholder="Custom message… ({{customerName}} supported)"
                />
                <div className="flex gap-2 pt-1">
                  <Button fullWidth onClick={createCampaign}>Create Campaign</Button>
                  <Button variant="ghost" onClick={() => setShowCampaignModal(false)}>Cancel</Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}
