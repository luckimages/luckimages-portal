import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import IntroAnimation from "@/components/IntroAnimation";
import PageTracker from "@/components/PageTracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Luck Images — Real Estate Photography Austin TX",
  description: "Professional real estate photography, drone, Matterport 3D tours, and video for Austin's top agents and developers. 24-hour turnaround. Call (512) 375-1585.",
  keywords: ["real estate photography Austin", "real estate photographer Austin TX", "drone photography Austin", "Matterport 3D tours Austin", "listing photos Austin", "architectural photography Austin"],
  openGraph: {
    title: "Luck Images — Real Estate Photography Austin TX",
    description: "Professional real estate photography, drone, Matterport 3D tours, and video for Austin's top agents and developers. 24-hour turnaround.",
    url: "https://www.luckimages.com",
    siteName: "Luck Images",
    locale: "en_US",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "LocalBusiness",
      "@id": "https://www.luckimages.com/#business",
      "name": "Luck Images",
      "alternateName": "Luck Images Real Estate Photography",
      "description": "Professional real estate photography, drone, Matterport 3D tours, and video for Austin's top agents and developers. 24-hour turnaround guaranteed.",
      "url": "https://www.luckimages.com",
      "telephone": "+15123751585",
      "email": "ryan@luckimages.com",
      "logo": "https://www.luckimages.com/logo.png",
      "image": "https://www.luckimages.com/og-image.jpg",
      "priceRange": "$$",
      "currenciesAccepted": "USD",
      "paymentAccepted": "Cash, Credit Card, Check",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Austin",
        "addressRegion": "TX",
        "addressCountry": "US"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 30.2672,
        "longitude": -97.7431
      },
      "areaServed": [
        { "@type": "City", "name": "Austin", "sameAs": "https://en.wikipedia.org/wiki/Austin,_Texas" },
        { "@type": "City", "name": "Round Rock" },
        { "@type": "City", "name": "Cedar Park" },
        { "@type": "City", "name": "Georgetown" },
        { "@type": "City", "name": "Pflugerville" },
        { "@type": "City", "name": "Leander" },
        { "@type": "City", "name": "Kyle" },
        { "@type": "City", "name": "Buda" }
      ],
      "sameAs": [
        "https://www.instagram.com/luckimages",
        "https://business.google.com"
      ],
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "5.0",
        "reviewCount": "3",
        "bestRating": "5",
        "worstRating": "1"
      },
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Real Estate Media Services",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Real Estate Listing Photography",
              "description": "Professional HDR listing photos that make properties stand out online. 24-hour turnaround."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Drone Photography & Video",
              "description": "FAA-certified aerial photography and video for real estate listings and developments in Austin TX."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Matterport 3D Tours",
              "description": "Immersive 3D virtual tours using Matterport technology for real estate listings."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Real Estate Video",
              "description": "Cinematic property walkthrough videos for real estate agents and developers."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Headshots",
              "description": "Professional headshots for real estate agents in Austin TX."
            }
          }
        ]
      }
    },
    {
      "@type": "WebSite",
      "@id": "https://www.luckimages.com/#website",
      "url": "https://www.luckimages.com",
      "name": "Luck Images",
      "description": "Real estate photography, drone, Matterport, and video — Austin TX",
      "publisher": { "@id": "https://www.luckimages.com/#business" }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How fast is the turnaround for real estate photos?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Luck Images guarantees 24-hour photo delivery for all standard real estate listing shoots."
          }
        },
        {
          "@type": "Question",
          "name": "What areas does Luck Images serve?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Luck Images serves the greater Austin area including Round Rock, Cedar Park, Georgetown, Pflugerville, Leander, Kyle, and Buda."
          }
        },
        {
          "@type": "Question",
          "name": "Does Luck Images offer drone photography?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Luck Images provides FAA-certified drone photography and aerial video for real estate listings across the Austin metro area."
          }
        },
        {
          "@type": "Question",
          "name": "Does Luck Images offer Matterport 3D tours?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Luck Images creates Matterport 3D virtual tours that allow buyers to walk through a property online before scheduling an in-person showing."
          }
        }
      ]
    }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col"><IntroAnimation /><PageTracker /><ClientProviders>{children}</ClientProviders></body>
    </html>
  );
}
