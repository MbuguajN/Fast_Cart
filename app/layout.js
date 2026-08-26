import { Suspense } from "react";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import TopProgressBar from "@/components/TopProgressBar";

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://myhappyhour.co.ke'),
  title: "Happy Hour! | 20-Minute Drinks & Wine Delivery in Nairobi",
  description: "Nairobi's premium 20-minute drinks, wine, and party supplies delivery service. Cold drinks delivered straight to your doorstep.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${montserrat.variable} scroll-smooth`}>
      <body className="antialiased min-h-screen flex flex-col selection:bg-[#840037] selection:text-white">
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        <AuthProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
