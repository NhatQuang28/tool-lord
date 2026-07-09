import { Sparkles } from "lucide-react";
import { enabledTools } from "@/modules/registry";
import { SiteNav } from "@/components/SiteNav";
import { ToolGrid } from "@/components/ToolGrid";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main className="page">
        <section className="container hero">
          <span className="eyebrow">
            <Sparkles size={14} strokeWidth={2.4} />
            Bộ công cụ web
          </span>
          <h1>
            Những công cụ nhỏ,
            <br />
            <span className="gradient-text">làm thật gọn.</span>
          </h1>
          <p>
            Mỗi tool là một module độc lập — nhanh, riêng tư và luôn sẵn sàng
            ngay trong trình duyệt.
          </p>
        </section>

        <section className="container">
          <h2 className="section-title">Công cụ</h2>
          <ToolGrid tools={enabledTools} />
        </section>

        <footer className="container footer">
          Tool Lord — làm bằng Next.js.
        </footer>
      </main>
    </>
  );
}
