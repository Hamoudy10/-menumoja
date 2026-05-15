import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Maximize2, Minimize2, Bell, Plus, X, Shield,
  AlertTriangle, Clock, Monitor, Wifi, WifiOff, Trash2,
  RefreshCw, CheckCircle2, Server, Loader2, Eye, EyeOff,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'

interface CameraForm {
  name: string; ip: string; port: string; username: string; password: string; location: string
}

const defaultForm: CameraForm = { name: '', ip: '', port: '554', username: '', password: '', location: '' }

export default function SurveillancePage() {
  const { cameras, alerts, fetchCameras, fetchAlerts, addCamera, updateCamera } = useStore()
  const [fullscreen, setFullscreen] = useState<string | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [newCam, setNewCam] = useState<CameraForm>(defaultForm)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'fail'>('idle')
  const [loading, setLoading] = useState(false)

  useEffect(() => { setLoading(true); Promise.all([fetchCameras(), fetchAlerts()]).finally(() => setLoading(false)) }, [])

  const allAlerts = (alerts || cameras.flatMap((c) =>
    c.alerts?.map((a: any) => ({ ...a, cameraName: c.name })) || []
  )).sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())

  const handleTestConnection = async () => {
    if (!newCam.ip) return
    setTesting(true)
    setTestResult('idle')
    await new Promise((r) => setTimeout(r, 2000))
    setTesting(false)
    setTestResult(Math.random() > 0.3 ? 'success' : 'fail')
  }

  const handleAddCamera = async () => {
    if (!newCam.name || !newCam.ip) return
    try {
      await addCamera({
        name: newCam.name,
        ip: newCam.ip,
        port: parseInt(newCam.port) || 554,
        username: newCam.username || undefined,
        password: newCam.password || undefined,
        location: newCam.location || undefined,
      })
      setNewCam(defaultForm)
      setShowSetup(false)
      setTestResult('idle')
      showSuccessToast('Camera added')
    } catch {
      showErrorToast('Failed to add camera')
    }
  }

  if (loading && cameras.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    )
  }

  if (fullscreen) {
    const cam = cameras.find((c) => c.id === fullscreen)
    if (!cam) return null
    return (
      <div className="fixed inset-0 z-50 bg-background-dark">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Badge variant={cam.active ? 'success' : 'danger'} size="lg">
            {cam.active ? 'Live' : 'Offline'}
          </Badge>
          <button onClick={() => setFullscreen(null)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
            <Minimize2 className="h-5 w-5" />
          </button>
        </div>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Camera className="h-20 w-20 text-white/20 mx-auto mb-4" />
            <h2 className="font-heading text-2xl text-white font-bold">{cam.name}</h2>
            <p className="font-accent text-white/50 mt-1">{cam.ip}:{cam.port || '554'}</p>
            {cam.location && <p className="font-accent text-white/30 mt-1">{cam.location}</p>}
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-success/20 px-4 py-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
              </span>
              <span className="font-accent text-sm text-success font-medium">{cam.active ? 'Streaming' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Surveillance</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Monitor your restaurant cameras and AI alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchCameras(); fetchAlerts() }} className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors">
            <RefreshCw className="h-4 w-4 text-text-secondary" />
          </button>
          <Button onClick={() => setShowSetup(true)}><Plus className="h-4 w-4" /> Add Camera</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cameras.length === 0 ? (
          <div className="sm:col-span-2 xl:col-span-3">
            <EmptyState
              icon={<Camera className="h-12 w-12" />}
              title="No cameras configured"
              description="Add your first camera to start monitoring your restaurant"
              actionLabel="Add Camera"
              onAction={() => setShowSetup(true)}
            />
          </div>
        ) : (
          cameras.map((cam) => {
            const unreadAlerts = (cam.alerts || []).filter((a: any) => !a.viewed).length
            return (
              <motion.div
                key={cam.id} layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-black/80 to-black/60 border border-white/10"
              >
                <div className="aspect-video bg-black/50 flex items-center justify-center relative">
                  <Camera className="h-12 w-12 text-white/20" />
                  {cam.active && (
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                      </span>
                      <span className="font-accent text-[10px] text-white/70 uppercase tracking-wider">Live</span>
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    {unreadAlerts > 0 && (<Badge variant="danger" size="sm">{unreadAlerts} alerts</Badge>)}
                    <button onClick={() => setFullscreen(cam.id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="font-accent text-sm text-white font-medium">{cam.name}</span>
                    <span className="font-accent text-[10px] text-white/50">{cam.ip}</span>
                  </div>
                  {!cam.active && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <div className="text-center">
                        <WifiOff className="h-8 w-8 text-red-400 mx-auto mb-2" />
                        <p className="font-accent text-sm text-red-400 font-medium">Offline</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  {cam.location && <p className="font-accent text-xs text-white/40">{cam.location}</p>}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {cam.active ? <Wifi className="h-3.5 w-3.5 text-success" /> : <WifiOff className="h-3.5 w-3.5 text-red-400" />}
                      <span className="font-accent text-xs text-white/60">{cam.active ? 'Connected' : 'Disconnected'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => updateCamera(cam.id, { active: !cam.active })}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-accent font-medium transition-colors ${
                          cam.active ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-success/20 text-success hover:bg-success/30'
                        }`}>
                        {cam.active ? 'Disable' : 'Enable'}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">AI Alerts</h3>
              <Badge variant="danger" size="sm">{allAlerts.filter((a: any) => !a.viewed).length} unread</Badge>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <AnimatePresence>
                {allAlerts.length === 0 ? (
                  <p className="text-center font-body text-sm text-text-secondary dark:text-white/40 py-8">No alerts yet. AI monitoring is active.</p>
                ) : (
                  allAlerts.map((alert: any) => (
                    <motion.div key={alert.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      className={`flex items-start gap-3 rounded-xl p-3 transition-colors ${!alert.viewed ? 'bg-secondary/5 border border-secondary/20' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        alert.type === 'motion' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' :
                        alert.type === 'sound' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                        'bg-red-100 text-red-600 dark:bg-red-900/30'
                      }`}>
                        {alert.type === 'motion' ? <ActivityIcon /> : alert.type === 'sound' ? <Bell className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-accent text-xs text-text-secondary dark:text-white/50 uppercase">{alert.cameraName || alert.camera}</span>
                          <Badge variant={alert.type === 'alert' ? 'danger' : alert.type === 'motion' ? 'warning' : 'info'} size="sm">{alert.type}</Badge>
                        </div>
                        <p className="font-body text-sm text-text-primary dark:text-white mt-0.5">{alert.message || alert.description}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock className="h-3 w-3 text-text-secondary dark:text-white/40" />
                          <span className="font-accent text-[10px] text-text-secondary dark:text-white/40">
                            {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : ''}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
            <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Camera Summary</h3>
            <div className="space-y-3">
              {[
                { icon: Monitor, label: 'Total Cameras', value: cameras.length, color: 'text-secondary' },
                { icon: Shield, label: 'Active', value: cameras.filter((c) => c.active).length, color: 'text-success' },
                { icon: AlertTriangle, label: 'Alerts Today', value: allAlerts.length, color: 'text-red-500' },
                { icon: null, label: 'Recording', value: 'All', color: 'text-success', pulse: true },
              ].map((stat, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5">
                  <div className="flex items-center gap-2">
                    {stat.pulse ? (
                      <div className="relative flex h-4 w-4 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
                      </div>
                    ) : stat.icon ? (
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    ) : null}
                    <span className="font-body text-sm text-text-primary dark:text-white/80">{stat.label}</span>
                  </div>
                  <span className={`font-accent font-bold ${stat.color}`}>{String(stat.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSetup && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowSetup(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-2xl bg-white dark:bg-primary-light p-6 border border-white/10 shadow-soft">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-secondary" />
                    <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white">Add Camera</h2>
                  </div>
                  <button onClick={() => setShowSetup(false)} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <X className="h-5 w-5 text-text-secondary" />
                  </button>
                </div>
                <div className="space-y-4">
                  <Input label="Camera Name" value={newCam.name} onChange={(e) => setNewCam({ ...newCam, name: e.target.value })} placeholder="e.g., Main Entrance" />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Input label="IP Address" value={newCam.ip} onChange={(e) => setNewCam({ ...newCam, ip: e.target.value })} placeholder="e.g., 192.168.1.100" />
                    </div>
                    <Input label="Port" value={newCam.port} onChange={(e) => setNewCam({ ...newCam, port: e.target.value })} placeholder="554" />
                  </div>
                  <Input label="Location (optional)" value={newCam.location} onChange={(e) => setNewCam({ ...newCam, location: e.target.value })} placeholder="e.g., Main Dining Area" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Username (optional)" value={newCam.username} onChange={(e) => setNewCam({ ...newCam, username: e.target.value })} placeholder="admin" />
                    <Input label="Password (optional)" type="password" value={newCam.password} onChange={(e) => setNewCam({ ...newCam, password: e.target.value })} placeholder="••••••••" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testing || !newCam.ip} className="flex-1">
                      {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
                      {testing ? 'Testing...' : 'Test Connection'}
                    </Button>
                    {testResult === 'success' && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
                    {testResult === 'fail' && <X className="h-5 w-5 text-red-500 shrink-0" />}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button fullWidth onClick={handleAddCamera} disabled={!newCam.name || !newCam.ip}>
                      <Plus className="h-4 w-4" /> Add Camera
                    </Button>
                    <Button variant="ghost" fullWidth onClick={() => { setShowSetup(false); setNewCam(defaultForm); setTestResult('idle') }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function ActivityIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}