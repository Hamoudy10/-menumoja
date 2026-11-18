import { Navbar, Hero, SocialProof, Features, HowItWorks, Pricing, Footer } from '@/components/landing'
import { ChefAIAssistant } from '@/components/landing/ChefAIAssistant'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background-light">
      <Navbar />
      <Hero />
      <SocialProof />
      <Features />
      <HowItWorks />
      <Pricing />
      <Footer />
      <ChefAIAssistant />
    </div>
  )
}
