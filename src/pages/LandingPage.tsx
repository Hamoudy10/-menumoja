import { Navbar, Hero, SocialProof, Features, HowItWorks, Pricing, Testimonials, Footer } from '@/components/landing'
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
      <Testimonials />
      <Footer />
      <ChefAIAssistant />
    </div>
  )
}
