import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'NutriBot — AI-Powered Nutrition Plans',
  description: 'Get a personalized nutrition plan crafted by an AI nutritionist with 30 years of experience. Tailored to your goals, preferences, and lifestyle.',
  keywords: 'nutrition, meal plan, diet, AI nutritionist, personalized nutrition, healthy eating',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {/* Background orbs */}
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
          {/* Main content */}
          <div className="relative z-10 min-h-screen">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
