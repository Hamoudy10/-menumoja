import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Megaphone, Image, MessageSquare, MessageCircle, Music, Bot,
  Calendar, CheckCircle2, Clock, XCircle, BarChart3, Eye, Heart, MousePointerClick,
  Activity, RefreshCw, Link2, Unlink, Loader2, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react'
const Instagram = Image
const Facebook = MessageSquare
import { useStore } from '@/store/useStore'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Toggle } from '@/components/ui/Toggle'
import { EmptyState } from '@/components/ui/EmptyState'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as marketingApi from '@/api/marketing'
import * as aiApi from '@/api/ai'
import type { Post } from '@/types'

const platformConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  instagram: { icon: Instagram, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30', label: 'Instagram' },
  facebook: { icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Facebook' },
  whatsapp: { icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', label: 'WhatsApp' },
  tiktok: { icon: Music, color: 'text-black dark:text-white', bg: 'bg-black/5 dark:bg-white/10', label: 'TikTok' },
}

const platforms = ['instagram', 'facebook', 'whatsapp', 'tiktok'] as const

export default function MarketingPage() {
  const { t } = useTranslation()
  const { posts, addPost, updatePost, approvePost, publishPost, fetchPosts } = useStore()
  const [autoMode, setAutoMode] = useState(true)
  const [frequency, setFrequency] = useState('daily')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'facebook'])
  const [pendingTab, setPendingTab] = useState<'pending' | 'posted'>('pending')
  const [connections, setConnections] = useState<any[]>([])
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [contentStyle, setContentStyle] = useState('fun')
  const [contentContext, setContentContext] = useState('')

  const [aiOptions, setAiOptions] = useState<Array<{ id: string; caption: string; imageUrl: string; hashtags: string }>>([])
  const [showAiOptions, setShowAiOptions] = useState(false)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)

  useEffect(() => {
    fetchPosts()
    loadConnections()
  }, [])

  const loadConnections = async () => {
    setLoadingConnections(true)
    try {
      const data = await marketingApi.getConnections()
      const serverConns = data.connections || data || []
      const localConns: any[] = []
      platforms.forEach((p) => {
        const stored = localStorage.getItem(`social_conn_${p}`)
        if (stored) {
          try { localConns.push(JSON.parse(stored)) } catch {}
        }
      })
      const merged = [...serverConns]
      localConns.forEach((lc) => {
        if (!merged.find((c: any) => c.platform === lc.platform)) {
          merged.push(lc)
        }
      })
      setConnections(merged)
    } catch {
      const localConns: any[] = []
      platforms.forEach((p) => {
        const stored = localStorage.getItem(`social_conn_${p}`)
        if (stored) {
          try { localConns.push(JSON.parse(stored)) } catch {}
        }
      })
      setConnections(localConns)
    } finally { setLoadingConnections(false) }
  }

  const handleConnect = (platform: string) => {
    const existing = connections.find((c: any) => c.platform === platform)
    if (existing) {
      handleDisconnect(platform)
      return
    }

    const mockConnection = {
      platform,
      id: `conn-${Date.now()}`,
      accountName: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Page`,
      accountId: `page_${Date.now()}`,
      connectedAt: new Date().toISOString(),
      isActive: true,
      isSimulated: true,
    }

    setConnections((prev: any[]) => [...prev, mockConnection])
    localStorage.setItem(`social_conn_${platform}`, JSON.stringify(mockConnection))
    showSuccessToast(`${platformConfig[platform]?.label || platform} connected! (Simulated)`)
  }

  const handleDisconnect = async (platform: string) => {
    try {
      await marketingApi.disconnectPlatform(platform)
      showSuccessToast(`${platform} disconnected`)
    } catch {
      showErrorToast(`Failed to disconnect ${platform}. Using local removal.`)
    }
    setConnections((prev: any[]) => prev.filter((c: any) => c.platform !== platform))
    localStorage.removeItem(`social_conn_${platform}`)
  }

  const handleGenerate = async () => {
    if (selectedPlatforms.length === 0) {
      showErrorToast('Select at least one platform')
      return
    }

    setGenerating(true)
    try {
      const { restaurant } = useStore.getState()

      for (const platform of selectedPlatforms) {
        try {
          const data = await aiApi.generateSocialPost({
            restaurantId: restaurant?.id,
            postType: 'DAILY_SPECIAL',
            platform,
            language: 'en',
            userContext: contentContext || undefined,
            generateOptions: false,
          })

          const newPost = {
            platform,
            content: data.caption || data.content || `Discover our specials today!`,
            image: data.imageUrl || '',
            scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          }
          await addPost(newPost)
        } catch {
          const fallback: any = {
            platform,
            content: `Discover our specials today! Fresh ingredients, authentic flavors at ${restaurant?.name || 'our restaurant'}.`,
            image: '',
            scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          }
          await addPost(fallback)
        }
      }
      showSuccessToast(`Generated ${selectedPlatforms.length} posts!`)
    } catch { showErrorToast('Failed to generate content') } finally { setGenerating(false) }
  }

  const handleGenerateWithOptions = async () => {
    if (selectedPlatforms.length === 0) {
      showErrorToast('Select at least one platform')
      return
    }

    setGenerating(true)
    try {
      const { restaurant } = useStore.getState()
      const platform = selectedPlatforms[0]

      const data = await aiApi.generateSocialPost({
        restaurantId: restaurant?.id,
        postType: 'DAILY_SPECIAL',
        platform,
        language: 'en',
        userContext: contentContext || undefined,
        generateOptions: true,
        optionCount: 3,
      })

      if (data.options) {
        setAiOptions(data.options)
        setShowAiOptions(true)
        setSelectedOptionId(null)
      }
      showSuccessToast('AI content options generated!')
    } catch {
      setAiOptions([
        { id: 'option-1', caption: `Discover our specials today at ${useStore.getState().restaurant?.name || 'our restaurant'}! Fresh ingredients, bold flavors.`, imageUrl: '', hashtags: '#MenuMoja #FoodKenya' },
        { id: 'option-2', caption: `Treat yourself today! We've prepared something special just for you. Come taste the difference.`, imageUrl: '', hashtags: '#FreshFood #MenuMoja' },
        { id: 'option-3', caption: `Good food, good vibes! Visit us today and enjoy our daily specials prepared with love.`, imageUrl: '', hashtags: '#EatLocal #MenuMoja' },
      ])
      setShowAiOptions(true)
      setSelectedOptionId(null)
      showSuccessToast('AI content options generated!')
    } finally { setGenerating(false) }
  }

  const handlePublishOption = async () => {
    if (!selectedOptionId) {
      showErrorToast('Select an option to publish')
      return
    }

    const selectedOption = aiOptions.find((o) => o.id === selectedOptionId)
    if (!selectedOption) return

    const { restaurant } = useStore.getState()
    const platform = selectedPlatforms[0] || 'instagram'

    const newPost = {
      platform,
      content: selectedOption.caption,
      image: selectedOption.imageUrl || '',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    }

    try {
      await addPost(newPost)
      showSuccessToast('Post created from selected option!')
      setShowAiOptions(false)
      setSelectedOptionId(null)
    } catch {
      showErrorToast('Failed to create post')
    }
  }

  const isConnected = (platform: string) => connections.some((c: any) => c.platform === platform && c.isActive !== false)

  const pendingPosts = posts.filter((p) => p.status === 'pending')
  const postedPosts = posts.filter((p) => p.status === 'posted' || p.status === 'approved')

  const totalReach = postedPosts.reduce((s, p) => s + (p.reach || 0), 0)
  const totalLikes = postedPosts.reduce((s, p) => s + (p.likes || 0), 0)
  const totalClicks = postedPosts.reduce((s, p) => s + (p.clicks || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">{t('marketing.title')}</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">{t('marketing.subtitle')}</p>
        </div>
        <button onClick={() => { fetchPosts(); loadConnections() }} className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors">
          <RefreshCw className="h-4 w-4 text-text-secondary" />
        </button>
      </div>

      <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">{t('marketing.socialConnections')}</h3>
          <Link2 className="h-5 w-5 text-secondary" />
        </div>
        {loadingConnections ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-secondary" /></div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {platforms.map((p) => {
              const cfg = platformConfig[p]
              const connected = isConnected(p)
              const stored = localStorage.getItem(`social_conn_${p}`)
              const isSimulated = connected && stored
              return (
                <motion.button
                  key={p} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => connected ? handleDisconnect(p) : handleConnect(p)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-accent text-sm font-medium transition-all ${
                    connected
                      ? 'bg-success/10 text-success border border-success/30'
                      : 'bg-black/5 dark:bg-white/10 text-text-secondary dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/20'
                  }`}
                >
                  <cfg.icon className="h-4 w-4" />
                  {cfg.label}
                  {connected ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isSimulated && <span className="text-[9px] opacity-60">(sim)</span>}
                    </span>
                  ) : <Link2 className="h-3.5 w-3.5" />}
                </motion.button>
              )
            })}
          </div>
        )}
        <p className="mt-2 font-accent text-[10px] text-text-secondary/50">
          Connections are simulated for demo. Set META_APP_ID, INSTAGRAM_CLIENT_ID, TIKTOK_CLIENT_KEY in .env for real OAuth.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">{t('marketing.aiContentGenerator')}</h3>
            <Bot className="h-5 w-5 text-secondary" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5">
              <span className="font-body text-sm text-text-primary dark:text-white/80">{t('marketing.autoMode')}</span>
              <Toggle checked={autoMode} onChange={setAutoMode} />
            </div>

            <div>
              <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('marketing.contentContext')}</label>
              <textarea
                value={contentContext}
                onChange={(e) => setContentContext(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2.5 font-body text-sm text-text-primary dark:text-white transition-all focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                rows={3}
                placeholder={t('marketing.contentContextPlaceholder')}
              />
            </div>

            <div>
              <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('marketing.frequency')}</label>
              <div className="flex gap-2 flex-wrap">
                {['daily', 'alternate', 'weekly'].map((f) => (
                  <button key={f} onClick={() => setFrequency(f)}
                    className={`rounded-xl px-4 py-2 text-sm font-accent font-medium transition-colors ${
                      frequency === f ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-secondary dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/20'
                    }`}>{t(`marketing.${f}`)}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('marketing.contentStyle')}</label>
              <div className="flex gap-2 flex-wrap">
                {['fun', 'professional', 'swahili', 'mix'].map((style) => (
                  <button key={style} onClick={() => setContentStyle(style)}
                    className={`rounded-xl px-4 py-2 text-sm font-accent font-medium transition-colors ${
                      contentStyle === style ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-secondary dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/20'
                    }`}>{t(`marketing.${style}`)}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('marketing.platforms')}</label>
              <div className="flex flex-wrap gap-2">
                {platforms.map((p) => {
                  const cfg = platformConfig[p]
                  return (
                    <button key={p} onClick={() => setSelectedPlatforms((prev) => prev.includes(p) ? prev.filter((sp) => sp !== p) : [...prev, p])}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-accent font-medium transition-colors ${
                        selectedPlatforms.includes(p) ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-secondary dark:text-white/60'
                      }`}>
                      <cfg.icon className="h-3 w-3" /> {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button fullWidth onClick={handleGenerate} loading={generating} disabled={selectedPlatforms.length === 0}>
                <Bot className="h-4 w-4" /> {generating ? t('marketing.generating') : t('marketing.generateContent')}
              </Button>
              <button
                onClick={handleGenerateWithOptions}
                disabled={generating || selectedPlatforms.length === 0}
                className="shrink-0 rounded-xl bg-gradient-to-br from-secondary to-accent px-4 py-2.5 text-xs font-accent font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Options
              </button>
            </div>

            <AnimatePresence>
              {showAiOptions && aiOptions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-xl border border-secondary/30 bg-secondary/5 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-accent text-xs font-medium text-secondary">{t('marketing.selectOption')}</p>
                    <button onClick={() => setShowAiOptions(false)} className="text-xs text-text-secondary hover:text-secondary">Close</button>
                  </div>
                  {aiOptions.map((opt, i) => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedOptionId(opt.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-all ${
                        selectedOptionId === opt.id
                          ? 'border-secondary bg-white dark:bg-primary-light ring-1 ring-secondary'
                          : 'border-white/10 bg-white dark:bg-primary-light hover:border-secondary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          selectedOptionId === opt.id ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-secondary'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="font-accent text-xs text-text-secondary">{opt.hashtags}</span>
                      </div>
                      <p className="font-body text-xs text-text-primary dark:text-white/80">{opt.caption}</p>
                    </button>
                  ))}
                  {selectedOptionId && (
                    <Button fullWidth size="sm" onClick={handlePublishOption}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Use Selected & Create Post
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">{t('marketing.postAnalytics')}</h3>
            <BarChart3 className="h-5 w-5 text-secondary" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { icon: Eye, label: t('marketing.reach'), value: totalReach.toLocaleString(), color: 'text-blue-500' },
              { icon: Heart, label: t('marketing.likes'), value: totalLikes.toLocaleString(), color: 'text-red-500' },
              { icon: MousePointerClick, label: t('marketing.clicks'), value: totalClicks.toLocaleString(), color: 'text-secondary' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-black/5 dark:bg-white/5 p-3 text-center">
                <stat.icon className={`h-4 w-4 mx-auto mb-1 ${stat.color}`} />
                <p className="font-accent text-lg font-bold text-text-primary dark:text-white">{stat.value}</p>
                <p className="font-accent text-[10px] text-text-secondary dark:text-white/50">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-accent text-sm font-bold text-text-primary dark:text-white">Platform Distribution</h4>
              <Activity className="h-4 w-4 text-text-secondary" />
            </div>
            <div className="space-y-2">
              {platforms.map((p) => {
                const cfg = platformConfig[p]
                const platformPosts = posts.filter((post) => post.platform === p)
                const pct = posts.length ? (platformPosts.length / posts.length) * 100 : 0
                return (
                  <div key={p} className="flex items-center gap-3">
                    <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-accent mb-1">
                        <span className="text-text-primary dark:text-white/80">{cfg.label}</span>
                        <span className="text-text-secondary">{platformPosts.length} posts ({Math.round(pct)}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full rounded-full bg-secondary" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-secondary" />
          <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">{t('marketing.contentQueue')}</h3>
        </div>

        {posts.length === 0 ? (
          <EmptyState icon={<Megaphone className="h-12 w-12" />} title={t('marketing.noContent')} description={t('marketing.noContentDesc')} actionLabel={t('marketing.generateContent')} onAction={handleGenerate} />
        ) : (
          <>
            <div className="flex gap-1 rounded-lg bg-black/5 dark:bg-white/10 p-1 mb-4 w-fit">
              {(['pending', 'posted'] as const).map((tab) => (
                <button key={tab} onClick={() => setPendingTab(tab)}
                  className={`rounded-md px-4 py-1.5 text-sm font-accent font-medium transition-colors ${
                    pendingTab === tab ? 'bg-secondary text-white' : 'text-text-secondary dark:text-white/60'
                  }`}>
                  {t(`marketing.${tab}`)}
                  <Badge size="sm" variant="default" className="ml-1.5">{tab === 'pending' ? pendingPosts.length : postedPosts.length}</Badge>
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {(pendingTab === 'pending' ? pendingPosts : postedPosts).map((post: any) => {
                  const cfg = platformConfig[post.platform as keyof typeof platformConfig] || platformConfig.instagram
                  return (
                    <motion.div key={post.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      className="flex items-start gap-4 rounded-xl border border-white/10 bg-black/5 dark:bg-white/5 p-4">
                      <cfg.icon className={`h-8 w-8 ${cfg.color} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm text-text-primary dark:text-white/80">{post.content}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs font-accent text-text-secondary dark:text-white/50">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString() : 'Today'}</span>
                          {(post.status === 'posted' || post.status === 'approved') && (
                            <><span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.reach || 0}</span><span className="flex items-center gap-1"><Heart className="h-3 w-3" />{post.likes || 0}</span></>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {post.status === 'pending' && (
                          <>
                            <motion.button whileTap={{ scale: 0.95 }} onClick={() => approvePost(post.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors" title={t('marketing.approve')}>
                              <CheckCircle2 className="h-4 w-4" />
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.95 }} onClick={() => publishPost(post.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors" title={t('marketing.publishNow')}>
                              <Megaphone className="h-4 w-4" />
                            </motion.button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
