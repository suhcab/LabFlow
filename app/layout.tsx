import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LabFlow · 연구를 재현 가능한 기록으로',
  description: '실험 프로토콜, 일정, 측정값과 불확도를 한곳에서 관리하는 학생 연구자를 위한 연구 노트',
  openGraph: {
    title: 'LabFlow · 연구를 재현 가능한 기록으로',
    description: '프로토콜, 일정, 측정값과 불확도를 한곳에서 관리하세요.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'LabFlow 소셜 미리보기' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LabFlow · 연구를 재현 가능한 기록으로',
    description: '프로토콜, 일정, 측정값과 불확도를 한곳에서 관리하세요.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
