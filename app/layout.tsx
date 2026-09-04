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

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const siteUrl = isGitHubPages
  ? 'https://akiralereal.github.io/config-installer/'
  : 'https://profilekit-installer.akirale.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'ProfileKit — iOS MobileConfig Installer',
  description:
    'Validate and install iOS configuration profiles from a local file, direct URL, or pasted XML.',
  applicationName: 'ProfileKit',
  icons: {
    icon: `${isGitHubPages ? '/config-installer' : ''}/favicon.svg`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
