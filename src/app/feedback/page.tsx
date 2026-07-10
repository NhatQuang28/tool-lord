// src/app/feedback/page.tsx
import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { FeedbackFeed } from "@/modules/feedback/components/FeedbackFeed";

export const metadata: Metadata = {
  title: "Góp ý",
  description: "Chia sẻ góp ý, đề xuất và bình luận. Ai cũng xem được; đăng nhập để tham gia.",
};

export default function FeedbackPage() {
  return (
    <>
      <SiteNav back={{ href: "/", label: "Trang chủ" }} title="Góp ý" />
      <main className="page">
        <div className="container fb-container">
          <header className="fb-page-head">
            <h1>Góp ý</h1>
            <p>Chia sẻ góp ý, đề xuất và bình luận. Ai cũng xem được; đăng nhập để tham gia.</p>
          </header>
          <FeedbackFeed />
        </div>
      </main>
    </>
  );
}
