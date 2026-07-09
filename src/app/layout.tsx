import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tool Lord — Bộ công cụ web nhanh, gọn, riêng tư",
  description:
    "Bộ sưu tập công cụ web nhỏ gọn chạy ngay trong trình duyệt: mã hóa tin nhắn, gõ mõ tích phúc và nhiều hơn nữa. Miễn phí, không cần đăng ký, không quảng cáo.",
};

// Applied before paint so the saved theme is set with no flash of the wrong mode.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
