import './globals.css';
import ServiceWorker from '../views/components/ServiceWorker';

export const metadata = {
  title: 'Slawn POS',
  description: 'Lightweight sales tracking for boutiques'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B6B4F'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
