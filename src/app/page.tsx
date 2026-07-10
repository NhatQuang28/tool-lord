import { Sparkles } from "lucide-react";
import { enabledTools, listedTools } from "@/modules/registry";
import { SiteNav } from "@/components/SiteNav";
import { ToolGrid } from "@/components/ToolGrid";
import { JsonLd } from "@/components/JsonLd";
import { toolsItemListJsonLd } from "@/lib/seo";

export default function HomePage() {
  return (
    <>
      <JsonLd data={toolsItemListJsonLd(listedTools)} />
      <SiteNav />
      <main className="page">
        <section className="container hero">
          <span className="eyebrow">
            <Sparkles size={14} strokeWidth={2.4} />
            Miễn phí · Không cần đăng ký
          </span>
          <h1>
            Những công cụ nhỏ,
            <br />
            <span className="gradient-text">làm nên việc lớn.</span>
          </h1>
          <p>
            Mỗi công cụ là một module độc lập — nhanh, riêng tư, chạy thẳng
            trong trình duyệt. Không cài đặt, không tài khoản, không quảng cáo.
          </p>
        </section>

        <section className="container">
          <h2 className="section-title">Tất cả công cụ</h2>
          <ToolGrid tools={enabledTools} />
        </section>

        <footer className="container footer">
          Tool Lord — công cụ web gọn nhẹ, tôn trọng quyền riêng tư của bạn.
        </footer>
      </main>
    </>
  );
}
