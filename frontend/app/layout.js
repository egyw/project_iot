import './globals.css';

export const metadata = {
  title: 'SmartLab Admin',
  description: 'SmartLab Asset Borrowing System — Admin Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
