import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'WhatsApp Marketing Platform',
  description: 'Enterprise WhatsApp marketing, automation, and live chat platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { borderRadius: '12px', background: '#1e293b', color: '#f1f5f9' } }} />
        {children}
      </body>
    </html>
  );
}
