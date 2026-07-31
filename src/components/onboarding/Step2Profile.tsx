import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Store, UtensilsCrossed, MapPin, Clock, Image, Send,
  ChefHat, Check, ArrowRight, ArrowLeft, Type, MessageCircle
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useStore } from '@/store/useStore'

const schema = z.object({
  restaurantType: z.string().min(1, 'Select your restaurant type'),
  cuisine: z.string().min(1, 'Enter your cuisine'),
  location: z.string().min(1, 'Enter your location'),
  description: z.string().min(10, 'Description too short'),
  openingHours: z.string().min(1, 'Enter opening hours'),
})

const aiDescriptions: Record<string, string> = {
  swahili: 'Authentic Swahili cuisine served in a warm, coastal-inspired setting. Our menu features traditional dishes made with fresh, locally-sourced ingredients and aromatic spices.',
  italian: 'Traditional Italian cuisine crafted with passion and the finest imported ingredients. From hand-rolled pasta to wood-fired pizzas, every dish tells a story of culinary heritage.',
  chinese: 'A vibrant Chinese dining experience featuring bold flavors and time-honored recipes. Our chefs master the perfect balance of sweet, sour, and savory in every dish.',
  indian: 'Rich and aromatic Indian cuisine featuring a symphony of spices. From creamy curries to tandoori specialties, each dish is a celebration of flavor.',
  mexican: 'Festive Mexican cuisine bursting with color and flavor. Fresh ingredients meet traditional cooking techniques for an unforgettable dining experience.',
  japanese: 'Elegant Japanese cuisine that celebrates seasonality and presentation. From sushi to ramen, experience the art of washoku.',
  american: 'Classic American comfort food reimagined with a modern twist. Burgers, steaks, and more, made from the finest locally-sourced ingredients.',
}

interface Props {
  onNext: () => void
  onPrev: () => void
}

type Step = 'type' | 'cuisine' | 'location' | 'description' | 'hours' | 'photo'

export default function Step2Profile({ onNext, onPrev }: Props) {
  const { onboarding, updateOnboarding } = useStore()
  const [chatStep, setChatStep] = useState<Step>('type')
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [showSkipDesc, setShowSkipDesc] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      restaurantType: onboarding.restaurantType,
      cuisine: onboarding.cuisine,
      location: onboarding.location,
      description: onboarding.description,
      openingHours: onboarding.openingHours,
    },
  })

  const formValues = watch()

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatStep, isAiTyping, formValues])

  const aiMessages: Record<string, string> = {
    type: "What type of restaurant are you opening? 🏪\n\nChoose one: Fine Dining, Casual Dining, Fast Casual, Cafe, Food Truck, Bakery, or other. Tell me in your own words!",
    cuisine: "Excellent! Now, what type of cuisine will you serve? 🍳\n\nFrom Swahili to Italian, Indian to Japanese — what flavors define your restaurant?",
    location: "Where are you located? 📍\n\nShare your restaurant's address or area so customers can find you easily.",
    description: "Give me a short description of your restaurant. 📝\n\nOr I can write one for you — just say the word! What's your restaurant's story?",
    hours: "What are your opening hours? 🕐\n\nLet customers know when you're open. e.g., Mon-Sun: 8AM - 11PM",
  }

  const simulateTyping = (nextStep: Step) => {
    setIsAiTyping(true)
    setTimeout(() => {
      setIsAiTyping(false)
      setChatStep(nextStep)
    }, 1200)
  }

  const handleTypeSubmit = (value: string) => {
    if (!value.trim()) return
    updateOnboarding({ restaurantType: value })
    simulateTyping('cuisine')
  }

  const handleCuisineSubmit = (value: string) => {
    if (!value.trim()) return
    updateOnboarding({ cuisine: value })
    simulateTyping('location')
  }

  const handleLocationSubmit = (value: string) => {
    if (!value.trim()) return
    updateOnboarding({ location: value })
    simulateTyping('description')
  }

  const handleDescriptionSubmit = (value: string) => {
    if (!value.trim() || value.length < 10) return
    updateOnboarding({ description: value })
    simulateTyping('hours')
  }

  const handleAiWriteDescription = () => {
    const key = Object.keys(aiDescriptions).find(k =>
      onboarding.cuisine.toLowerCase().includes(k)
    ) || 'swahili'
    const desc = aiDescriptions[key]
    setValue('description', desc)
    updateOnboarding({ description: desc })
    setShowSkipDesc(true)
    setTimeout(() => {
      setIsAiTyping(false)
      setChatStep('hours')
    }, 1500)
  }

  const handleHoursSubmit = (value: string) => {
    if (!value.trim()) return
    updateOnboarding({ openingHours: value })
    setTimeout(() => setChatStep('photo'), 800)
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        setSelectedImage(dataUrl)
        updateOnboarding({ logo: dataUrl })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        setSelectedImage(dataUrl)
        updateOnboarding({ logo: dataUrl })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const allAnswered = onboarding.restaurantType && onboarding.cuisine &&
    onboarding.location && onboarding.description && onboarding.openingHours

  const ChatBubble = ({ text, isAi }: { text: string; isAi: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 20, x: isAi ? -20 : 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      className={`flex ${isAi ? 'justify-start' : 'justify-end'} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-5 py-3 ${
          isAi
            ? 'bg-white border border-gray-100 shadow-soft rounded-bl-md'
            : 'bg-secondary text-white rounded-br-md'
        }`}
      >
        {isAi && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center">
              <ChefHat className="w-3.5 h-3.5 text-secondary" />
            </div>
            <span className="text-xs font-accent font-semibold text-secondary">Chef AI</span>
          </div>
        )}
        <p className={`text-sm whitespace-pre-line ${isAi ? 'text-text-primary' : 'text-white'}`}>
          {text}
        </p>
      </div>
    </motion.div>
  )

  const TypingIndicator = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start mb-4"
    >
      <div className="bg-white border border-gray-100 shadow-soft rounded-2xl rounded-bl-md px-5 py-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center">
            <ChefHat className="w-3.5 h-3.5 text-secondary" />
          </div>
          <span className="text-xs font-accent font-semibold text-secondary">Chef AI</span>
        </div>
        <div className="flex gap-1.5 py-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              className="w-2 h-2 rounded-full bg-secondary/40"
            />
          ))}
        </div>
      </div>
    </motion.div>
  )

  const UserBubble = ({ text }: { text: string }) => (
    <ChatBubble text={text} isAi={false} />
  )

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 rounded-full text-secondary text-sm font-accent font-semibold mb-3">
          <MessageCircle className="w-4 h-4" />
          Chat with Chef AI
        </div>
        <h2 className="text-2xl font-heading font-bold text-primary">Let's Set Up Your Profile</h2>
        <p className="text-text-secondary text-sm mt-1">I'll ask a few questions to get to know your restaurant</p>
      </div>

      <Card padding="none" className="overflow-hidden mb-6">
        <div className="h-[520px] overflow-y-auto p-6 bg-gradient-to-b from-accent/10 to-white">
          <ChatBubble text={aiMessages.type} isAi />

          {formValues.restaurantType && (
            <>
              <UserBubble text={formValues.restaurantType} />
              {chatStep === 'cuisine' && !isAiTyping && (
                <>
                  <ChatBubble text={aiMessages.cuisine} isAi />
                  <div className="flex justify-end mb-4">
                    <div className="max-w-[80%] w-full">
                      <input
                        type="text"
                        value={formValues.cuisine}
                        onChange={(e) => {
                          setValue('cuisine', e.target.value)
                          updateOnboarding({ cuisine: e.target.value })
                        }}
                        placeholder="e.g., Swahili, Italian, Indian..."
                        className="w-full px-4 py-3 rounded-2xl border-2 border-secondary/30 bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none transition-all text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleCuisineSubmit(formValues.cuisine)}
                        autoFocus
                      />
                    </div>
                  </div>
                </>
              )}
              {isAiTyping && chatStep === 'cuisine' && <TypingIndicator />}
            </>
          )}

          {formValues.cuisine && chatStep !== 'type' && chatStep !== 'cuisine' && (
            <>
              <ChatBubble text={aiMessages.cuisine} isAi />
              <UserBubble text={formValues.cuisine} />
              {chatStep === 'location' && !isAiTyping && (
                <>
                  <ChatBubble text={aiMessages.location} isAi />
                  <div className="flex justify-end mb-4">
                    <div className="max-w-[80%] w-full space-y-2">
                      <input
                        type="text"
                        value={formValues.location}
                        onChange={(e) => {
                          setValue('location', e.target.value)
                          updateOnboarding({ location: e.target.value })
                        }}
                        placeholder="e.g., Mombasa, Kenya"
                        className="w-full px-4 py-3 rounded-2xl border-2 border-secondary/30 bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none transition-all text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleLocationSubmit(formValues.location)}
                        autoFocus
                      />
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl text-xs text-text-secondary">
                        <MapPin className="w-3.5 h-3.5" />
                        Or pick on map
                      </div>
                    </div>
                  </div>
                </>
              )}
              {isAiTyping && chatStep === 'location' && <TypingIndicator />}
            </>
          )}

          {formValues.location && chatStep !== 'type' && chatStep !== 'cuisine' && chatStep !== 'location' && (
            <>
              <ChatBubble text={aiMessages.location} isAi />
              <UserBubble text={formValues.location} />
              {chatStep === 'description' && !isAiTyping && (
                <>
                  <ChatBubble text={aiMessages.description} isAi />
                  <div className="flex justify-end mb-4">
                    <div className="max-w-[80%] w-full space-y-2">
                      <textarea
                        value={formValues.description}
                        onChange={(e) => {
                          setValue('description', e.target.value)
                          updateOnboarding({ description: e.target.value })
                        }}
                        placeholder="Tell your restaurant's story..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-2xl border-2 border-secondary/30 bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none transition-all text-sm resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleAiWriteDescription}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-secondary to-accent text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity"
                        >
                          <Type className="w-3.5 h-3.5" />
                          Let AI write this
                        </button>
                        <button
                          onClick={() => handleDescriptionSubmit(formValues.description)}
                          disabled={formValues.description.length < 10}
                          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-light transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {isAiTyping && chatStep === 'description' && <TypingIndicator />}
            </>
          )}

          {formValues.description && chatStep !== 'type' && chatStep !== 'cuisine' && chatStep !== 'location' && chatStep !== 'description' && (
            <>
              <ChatBubble text={aiMessages.description} isAi />
              <UserBubble text={formValues.description} />
              {chatStep === 'hours' && !isAiTyping && (
                <>
                  <ChatBubble text={aiMessages.hours} isAi />
                  <div className="flex justify-end mb-4">
                    <div className="max-w-[80%] w-full">
                      <input
                        type="text"
                        value={formValues.openingHours}
                        onChange={(e) => {
                          setValue('openingHours', e.target.value)
                          updateOnboarding({ openingHours: e.target.value })
                        }}
                        placeholder="e.g., Mon-Sun: 8AM - 11PM"
                        className="w-full px-4 py-3 rounded-2xl border-2 border-secondary/30 bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none transition-all text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleHoursSubmit(formValues.openingHours)}
                        autoFocus
                      />
                    </div>
                  </div>
                </>
              )}
              {isAiTyping && chatStep === 'hours' && <TypingIndicator />}
            </>
          )}

          {formValues.openingHours && chatStep === 'photo' && (
            <>
              <ChatBubble text={aiMessages.hours} isAi />
              <UserBubble text={formValues.openingHours} />
              <ChatBubble text="Perfect! Now let's add a profile photo for your restaurant. 📸" isAi />
              <div className="flex justify-end mb-4">
                <div
                  ref={fileInputRef}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`max-w-[80%] w-full border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-secondary bg-secondary/5'
                      : selectedImage
                        ? 'border-success bg-success/5'
                        : 'border-gray-300 hover:border-secondary/50'
                  }`}
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  {selectedImage ? (
                    <div className="space-y-2">
                      <img src={selectedImage} alt="Preview" className="w-20 h-20 rounded-xl mx-auto object-cover" />
                      <p className="text-xs text-success font-medium">Photo uploaded ✓</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Image className="w-8 h-8 text-gray-400 mx-auto" />
                      <p className="text-sm text-text-secondary">Drop your logo here or click to browse</p>
                      <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
                    </div>
                  )}
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>
              </div>
            </>
          )}

          <div ref={chatEndRef} />
        </div>
      </Card>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onPrev} icon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onNext}
          fullWidth
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
          disabled={!allAnswered}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
